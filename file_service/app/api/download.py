from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.encryption import decrypt_file, decrypt_key
from app.models.encryption_key import EncryptionKey
from app.models.file import File
from app.models.permission import FilePermission
from app.services.audit_service import create_audit_log


router = APIRouter()


@router.get("/{file_id}/download")
def download_file(
    file_id: int,
    request: Request,
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

    # Owner check
    allowed = file_record.owner_id == current_user_id

    # Permission check
    if not allowed:
        permission = (
            db.query(FilePermission)
            .filter(
                FilePermission.file_id == file_id,
                FilePermission.shared_with_user_id == current_user_id,
                FilePermission.permission == "READ",
            )
            .first()
        )

        allowed = permission is not None

    if not allowed:
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    # New encryption-key architecture:
    # the wrapped key is stored in encryption_keys,
    # while files.encryption_key may be NULL.
    key_record = (
        db.query(EncryptionKey)
        .filter(EncryptionKey.file_id == file_id)
        .first()
    )

    if not key_record:
        raise HTTPException(
            status_code=500,
            detail="Encryption key not found",
        )

    try:
        with open(file_record.storage_path, "rb") as f:
            encrypted_data = f.read()
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail="Stored file not found",
        )

    try:
        file_key = decrypt_key(
            key_record.encrypted_key.encode()
        )

        decrypted_data = decrypt_file(
            encrypted_data,
            file_key,
        )
    except Exception:
        # Do not expose cryptographic/internal exception details
        # to the client.
        raise HTTPException(
            status_code=500,
            detail="Unable to decrypt file",
        )

    create_audit_log(
        db,
        file_id,
        current_user_id,
        "DOWNLOAD",
        request.client.host,
        request.headers.get("user-agent"),
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
