from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("iot_devices.id", ondelete="CASCADE"), index=True, nullable=False)
    temperature: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    humidity: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    soil_moisture: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    light_intensity: Mapped[Decimal] = mapped_column(Numeric(7, 2), nullable=False)
    battery_level: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    device = relationship("IotDevice", back_populates="readings")
