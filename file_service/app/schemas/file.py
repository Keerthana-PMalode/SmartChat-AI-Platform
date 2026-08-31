from datetime import datetime

from pydantic import BaseModel


class FileResponse(BaseModel):

    id: int

    original_filename: str

    file_size: int | None

    mime_type: str | None

    status: str

    uploaded_at: datetime

    class Config:

        from_attributes = True


class ShareRequest(BaseModel):

    user_id: int

    permission: str = "READ"
