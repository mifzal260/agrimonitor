from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.mixins import TimestampMixin


class SymptomRecord(TimestampMixin, Base):
    __tablename__ = "symptom_records"
    __table_args__ = (
        CheckConstraint(
            "(symptom_id IS NOT NULL AND custom_symptom_name IS NULL) OR "
            "(symptom_id IS NULL AND custom_symptom_name IS NOT NULL)",
            name="ck_symptom_record_symptom_source",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    planting_record_id: Mapped[int] = mapped_column(ForeignKey("planting_records.id"), nullable=False)
    symptom_id: Mapped[int | None] = mapped_column(ForeignKey("symptoms.id"))
    custom_symptom_name: Mapped[str | None] = mapped_column(String(120))
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    planting_record = relationship("PlantingRecord", back_populates="symptom_records")
    symptom = relationship("Symptom", back_populates="symptom_records")
    alerts = relationship("Alert", back_populates="symptom_record")