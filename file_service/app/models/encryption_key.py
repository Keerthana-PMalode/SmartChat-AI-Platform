from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func


from app.core.database import Base


class EncryptionKey(Base):
    __tablename__ = "encryption_keys"

    id = Column(Integer, primary_key=True)

    file_id = Column(
        Integer,
        ForeignKey("files.id", ondelete="CASCADE"),
        nullable=False,
    )

    encrypted_key = Column(Text, nullable=False)

    key_algorithm = Column(
        String(50),
        default="Fernet",
    )

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(), 
    )
