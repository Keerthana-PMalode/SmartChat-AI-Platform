from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.core.database import Base

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)

    # Optional link to a user (admin endpoints)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Session-based chat (chat endpoints)
    session_id = Column(String, index=True, nullable=True)

    sender = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    response = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="chats")
