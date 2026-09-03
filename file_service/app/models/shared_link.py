from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.core.database import Base


class SharedLink(Base):
    __tablename__ = "shared_links"

    id = Column(Integer, primary_key=True)

    file_id = Column(
        Integer,
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
    )

    token = Column(
        String(255),
        unique=True,
        nullable=False,
    )

    expires_at = Column(DateTime, nullable=True)

    max_downloads = Column(Integer, nullable=True)

    download_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    created_by = Column(
        Integer,
        nullable=False,
    )

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=True,
    )