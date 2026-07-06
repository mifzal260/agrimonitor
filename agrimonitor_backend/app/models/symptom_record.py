from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.mixins import TimestampMixin


class SymptomRecord(TimestampMixin, Base):
    __tablename__ = "symptom_records"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    planting_record_id: Mapped[int] = mapped_column(ForeignKey("planting_records.id"), nullable=False)
    symptom_id: Mapped[int] = mapped_column(ForeignKey("symptoms.id"), nullable=False)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    planting_record = relationship("PlantingRecord", back_populates="symptom_records")
    symptom = relationship("Symptom", back_populates="symptom_records")
    alerts = relationship("Alert", back_populates="symptom_record")