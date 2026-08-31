from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.file import File
from app.schemas.file import ShareRequest
from app.services.file_service import share_file

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
