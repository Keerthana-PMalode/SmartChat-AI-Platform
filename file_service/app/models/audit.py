from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)

from app.core.database import Base


class FileAccessLog(Base):

    __tablename__ = "file_access_logs"

    __table_args__ = (
        CheckConstraint(
            """
            (
                access_method = 'AUTHENTICATED'
                AND user_id IS NOT NULL
                AND share_link_id IS NULL
            )
            OR
            (
                access_method = 'SHARE_LINK'
                AND user_id IS NULL
                AND share_link_id IS NOT NULL
            )
            """,
            name="ck_file_access_logs_access_context",
        ),
    )

    id = Column(Integer, primary_key=True)

    file_id = Column(
        Integer,
        nullable=False,
    )

    user_id = Column(
        Integer,
        nullable=True,
    )

    share_link_id = Column(
        Integer,
        ForeignKey(
            "shared_links.id",
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    access_method = Column(
        String(30),
        nullable=False,
    )

    action = Column(
        String(50),
        nullable=False,
    )

    ip_address = Column(String(50))

    user_agent = Column(Text)

    access_time = Column(
        DateTime(timezone=True),
        server_default=func.now(),
    )