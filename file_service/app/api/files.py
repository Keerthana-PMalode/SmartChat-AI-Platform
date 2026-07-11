from fastapi import (
    APIRouter,
    Depends
)

from sqlalchemy.orm import Session

from app.core.database import get_db

from app.schemas.file import FileResponse

from app.services.file_service import get_user_files



router = APIRouter()



@router.get(
    "",
    response_model=list[FileResponse]
)
def list_files(

    db: Session = Depends(get_db)

):

    # Temporary user
    # Later replace with JWT user id

    user_id = 1


    return get_user_files(
        db,
        user_id
    )