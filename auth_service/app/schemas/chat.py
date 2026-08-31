from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChatCreate(BaseModel):
    session_id: str
    sender: str
    message: str
    response: str | None = None


class ChatResponse(BaseModel):
    id: int
    session_id: str
    sender: str
    message: str
    response: str
    user_id: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)
