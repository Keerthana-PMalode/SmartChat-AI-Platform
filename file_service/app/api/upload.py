from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Depends
)

from sqlalchemy.orm import Session

from app.core.database import get_db

from app.services.file_service import upload_file

from app.core.dependencies import get_current_user



router = APIRouter()

@router.post("/upload")
async def upload(

    file: UploadFile = File(...),

    db: Session = Depends(get_db),

    current_user_id: int = Depends(get_current_user)

):

    content = await file.read()


    result = upload_file(

        db,

        {
            "filename": file.filename,
            "content": content,
            "content_type": file.content_type
        },

        owner_id=current_user_id

    )


    return {

        "id": result.id,

        "filename": result.original_filename,

        "status": result.status

    }