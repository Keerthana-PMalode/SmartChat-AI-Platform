from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.schemas.file import FileResponse
from app.services.file_service import delete_file, get_user_files

router = APIRouter()


@router.get(
    "",
    response_model=list[FileResponse],
    include_in_schema=False,
)
@router.get(
    "/",
    response_model=list[FileResponse],
)
def list_files(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user),
):
    return get_user_files(db, current_user_id)


@router.delete("/{file_id}")
def delete(
    file_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user),
):
    record = delete_file(
        db,
        file_id,
        current_user_id,
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="File not found",
        )

    return {
        "message": "File deleted successfully",
        "id": file_id,
    }
