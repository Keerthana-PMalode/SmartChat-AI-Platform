from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.services.file_service import upload_file

MAX_FILE_SIZE = 100 * 1024 * 1024

router = APIRouter()


@router.post("/upload")
async def upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user),
):

    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="File too large. Maximum allowed size is 100 MB.",
        )

    result = upload_file(
        db,
        {
            "filename": file.filename,
            "content": content,
            "content_type": file.content_type,
        },
        owner_id=current_user_id,
    )

    return {
        "id": result.id,
        "filename": result.original_filename,
        "status": result.status,
    }
