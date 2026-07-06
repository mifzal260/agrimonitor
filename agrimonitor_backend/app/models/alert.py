from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.mixins import TimestampMixin


class Alert(TimestampMixin, Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    planting_record_id: Mapped[int] = mapped_column(ForeignKey("planting_records.id"), nullable=False)
    symptom_record_id: Mapped[int | None] = mapped_column(ForeignKey("symptom_records.id"))
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    planting_record = relationship("PlantingRecord", back_populates="alerts")
    symptom_record = relationship("SymptomRecord", back_populates="alerts")