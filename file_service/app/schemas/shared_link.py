from datetime import datetime

from pydantic import BaseModel, Field


class ShareLinkCreate(BaseModel):
    expires_at: datetime | None = None
    max_downloads: int | None = Field(
        default=None,
        gt=0,
    )


class ShareLinkResponse(BaseModel):
    id: int
    file_id: int
    url: str
    expires_at: datetime | None
    max_downloads: int | None
    download_count: int
