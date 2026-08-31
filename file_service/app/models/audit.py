from sqlalchemy import Column, DateTime, Integer, String, Text, func

from app.core.database import Base


class FileAccessLog(Base):

    __tablename__ = "file_access_logs"

    id = Column(Integer, primary_key=True)

    file_id = Column(Integer, nullable=False)

    user_id = Column(Integer, nullable=False)

    action = Column(String(50), nullable=False)

    ip_address = Column(String(50))

    user_agent = Column(Text)

    access_time = Column(DateTime(timezone=True), server_default=func.now())
