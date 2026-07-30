from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.mixins import TimestampMixin


class IotDevice(TimestampMixin, Base):
    __tablename__ = "iot_devices"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    device_code: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    device_name: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str] = mapped_column(String(120), nullable=False)
    data_source: Mapped[str] = mapped_column(String(30), nullable=False, default="simulation")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="online")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    readings = relationship("SensorReading", back_populates="device", cascade="all, delete-orphan")
