from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from fastapi.responses import Response

from sqlalchemy.orm import Session

from app.core.database import get_db

from app.models.file import File

from app.core.encryption import decrypt_file
from app.core.dependencies import get_current_user
from app.models.permission import FilePermission
from app.services.audit_service import create_audit_log
from fastapi import Request


router = APIRouter()

@router.get("/{file_id}/download")
def download_file(
    file_id:int,
    request:Request,
    db:Session=Depends(get_db),
    current_user_id:int=Depends(get_current_user)
):

    file_record = (

        db.query(File)

        .filter(
            File.id == file_id
        )

        .first()

    )


    if not file_record:

        raise HTTPException(
            status_code=404,
            detail="File not found"
        )


    allowed = False


    # Owner check

    if file_record.owner_id == current_user_id:

        allowed=True



    # Permission check

    if not allowed:

        permission=(

            db.query(FilePermission)

            .filter(

                FilePermission.file_id == file_id,

                FilePermission.shared_with_user_id
                ==
                current_user_id,

                FilePermission.permission
                ==
                "READ"

            )

            .first()

        )


        if permission:

            allowed=True



    if not allowed:

        raise HTTPException(

            status_code=403,

            detail="Access denied"

        )


    # Existing decrypt logic continues here


    try:

        with open(
            file_record.storage_path,
            "rb"
        ) as f:

            encrypted_data = f.read()



        decrypted_data = decrypt_file(

            encrypted_data,

            file_record.encryption_key.encode()

        )
	
        create_audit_log(

            db,

            file_id,

            current_user_id,

            "DOWNLOAD",

            request.client.host,

            request.headers.get("user-agent")

       )	


        return Response(

            content=decrypted_data,

            media_type=file_record.mime_type,

            headers={

                "Content-Disposition":
                f'attachment; filename="{file_record.original_filename}"'

            }

        )


    except Exception as e:


        raise HTTPException(

            status_code=500,

            detail=str(e)

        )