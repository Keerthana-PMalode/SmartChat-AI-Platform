from datetime import datetime, timezone
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.encryption import decrypt_file, decrypt_key
from app.models.encryption_key import EncryptionKey

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.file import File
from app.models.shared_link import SharedLink
from app.schemas.file import ShareRequest
from app.schemas.shared_link import ShareLinkCreate, ShareLinkResponse
from app.services.file_service import share_file
from app.services.audit_service import create_audit_log



router = APIRouter()

@router.post("/{file_id}/share")
def share(
    file_id: int,
    request: ShareRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user),
):
    file_record = db.query(File).filter(File.id == file_id).first()

    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")

    if file_record.owner_id != current_user_id:
        raise HTTPException(status_code=403, detail="Only owner can share")

    permission = share_file(
        db, file_id, current_user_id, request.user_id, request.permission
    )

    return {
        "message": "File shared",
        "file_id": permission.file_id,
        "shared_with": permission.shared_with_user_id,
        "permission": permission.permission,
    }

@router.post(
    "/{file_id}/share-link",
    response_model=ShareLinkResponse,
)
def create_share_link(
    file_id: int,
    request: ShareLinkCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user),
):
    file_record = (
        db.query(File)
        .filter(File.id == file_id)
        .first()
    )

    if not file_record:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    if file_record.owner_id != current_user_id:
        raise HTTPException(
            status_code=403,
            detail="Only owner can create share links",
        )

    # Validate expiration before creating the share link.
    expires_at = request.expires_at

    if expires_at is not None:
        # Convert timezone-aware datetime to UTC.
        if expires_at.tzinfo is not None:
            expires_at = expires_at.astimezone(timezone.utc).replace(
                tzinfo=None
            )

        # Database stores expires_at as a naive UTC datetime.
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        if expires_at <= now:
            raise HTTPException(
                status_code=400,
                detail="Expiration time must be in the future",
            )

    token = secrets.token_urlsafe(32)

    shared_link = SharedLink(
        file_id=file_record.id,
        token=token,
        expires_at=expires_at,
        max_downloads=request.max_downloads,
        download_count=0,
        created_by=current_user_id,
    )

    db.add(shared_link)
    db.commit()
    db.refresh(shared_link)

    return ShareLinkResponse(
        id=shared_link.id,
        file_id=shared_link.file_id,
        url=f"/files/shared/{shared_link.token}",
        expires_at=shared_link.expires_at,
        max_downloads=shared_link.max_downloads,
        download_count=shared_link.download_count,
    )


@router.get("/shared/{token}")
def download_shared_file(
    token: str,
    request: Request,
    db: Session = Depends(get_db),
):
    shared_link = (
        db.query(SharedLink)
        .filter(SharedLink.token == token)
        .first()
    )

    if not shared_link:
        raise HTTPException(
            status_code=404,
            detail="Share link not found",
        )

    # Check expiration
    if shared_link.expires_at is not None:
        now = datetime.now(timezone.utc).replace(tzinfo=None)

    if now >= shared_link.expires_at:
        raise HTTPException(
            status_code=410,
            detail="Share link has expired",
        )

    # Check download limit
    if (
        shared_link.max_downloads is not None
        and shared_link.download_count >= shared_link.max_downloads
    ):
        raise HTTPException(
            status_code=410,
            detail="Share link download limit reached",
        )

    # Find the associated file
    file_record = (
        db.query(File)
        .filter(File.id == shared_link.file_id)
        .first()
    )

    if not file_record:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    # Find wrapped encryption key
    key_record = (
        db.query(EncryptionKey)
        .filter(EncryptionKey.file_id == file_record.id)
        .first()
    )

    if not key_record:
        raise HTTPException(
            status_code=500,
            detail="Encryption key not found",
        )

    # Read encrypted file
    try:
        with open(file_record.storage_path, "rb") as f:
            encrypted_data = f.read()
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Stored file not found",
        )

    # Decrypt file
    try:
        file_key = decrypt_key(
            key_record.encrypted_key.encode()
        )

        decrypted_data = decrypt_file(
            encrypted_data,
            file_key,
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to decrypt file",
        )

    # Count successful download
    shared_link.download_count += 1

    # Audit successful anonymous share-link download.
    create_audit_log(
        db,
        file_record.id,
        None,
        "DOWNLOAD",
        request.client.host,
        request.headers.get("user-agent"),
        share_link_id=shared_link.id,
        access_method="SHARE_LINK",
    )

    return Response(
        content=decrypted_data,
        media_type=file_record.mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{file_record.original_filename}"'
            )
        },
    )