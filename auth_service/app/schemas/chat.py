from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChatCreate(BaseModel):
    session_id: str
    sender: str
    message: str
    response: str | None = None

class ChatMessageResponse(BaseModel):
    id: int
    chat_id: int
    role: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class ChatResponse(BaseModel):
    id: int
    session_id: str
    user_id: int
    timestamp: datetime
    messages: list[ChatMessageResponse]

    model_config = ConfigDict(from_attributes=True)