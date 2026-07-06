from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.mixins import TimestampMixin


class PlantingRecord(TimestampMixin, Base):
    __tablename__ = "planting_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    crop_id: Mapped[int] = mapped_column(ForeignKey("crops.id"), nullable=False)
    field_name: Mapped[str] = mapped_column(String(120), nullable=False)
    planting_date: Mapped[date] = mapped_column(Date, nullable=False)
    area_size: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="healthy")
    notes: Mapped[str | None] = mapped_column(Text)

    user = relationship("User", back_populates="planting_records")
    crop = relationship("Crop", back_populates="planting_records")
    activities = relationship("Activity", back_populates="planting_record")
    symptom_records = relationship("SymptomRecord", back_populates="planting_record")
    costs = relationship("Cost", back_populates="planting_record")
    harvests = relationship("Harvest", back_populates="planting_record")
    alerts = relationship("Alert", back_populates="planting_record")