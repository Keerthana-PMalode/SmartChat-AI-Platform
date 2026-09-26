from app.core.database import Base
from sqlalchemy import Column, DateTime, Integer, String, Text, func


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)

    key = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )

    value = Column(
        Text,
        nullable=False,
    )

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(
        Integer,
        nullable=True,
        index=True,
    )

    username = Column(
        String(255),
        nullable=True,
    )

    level = Column(
        String(20),
        nullable=False,
        default="info",
        index=True,
    )

    action = Column(
        String(255),
        nullable=False,
    )

    details = Column(
        Text,
        nullable=True,
    )

    timestamp = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
