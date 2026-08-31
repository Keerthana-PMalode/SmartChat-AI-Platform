from sqlalchemy import BigInteger, Column, DateTime, Integer, String, func

from app.core.database import Base


class File(Base):

    __tablename__ = "files"

    id = Column(Integer, primary_key=True)

    owner_id = Column(Integer, nullable=False)

    original_filename = Column(String(255), nullable=False)

    encrypted_filename = Column(String(255), nullable=False)

    file_size = Column(BigInteger)

    mime_type = Column(String(100))

    encryption_algorithm = Column(
        String(50),
        default="Fernet+WrappedKey",
    )

    encryption_key = Column(String, nullable=True)

    storage_path = Column(String, nullable=False)

    file_hash = Column(String(128))

    status = Column(String(20), default="ACTIVE")

    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
