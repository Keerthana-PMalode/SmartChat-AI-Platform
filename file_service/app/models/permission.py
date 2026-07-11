from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    func
)

from app.core.database import Base



class FilePermission(Base):

    __tablename__ = "file_permissions"


    id = Column(
        Integer,
        primary_key=True
    )


    file_id = Column(
        Integer,
        nullable=False
    )


    shared_with_user_id = Column(
        Integer,
        nullable=False
    )


    permission = Column(
        String(20),
        default="READ"
    )


    shared_by = Column(
        Integer,
        nullable=False
    )


    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now()
    )