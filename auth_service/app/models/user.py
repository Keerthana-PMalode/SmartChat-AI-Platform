from app.core.database import Base
from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship


class User(Base):
    __tablename__ = "users"

    # Keep only a primary key if you still want a users table
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    role = Column(String(20), nullable=False, default="user")

    # Relationship to ChatHistory
    chats = relationship(
        "ChatHistory", back_populates="user", cascade="all, delete-orphan"
    )
