from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.mixins import TimestampMixin


class Activity(TimestampMixin, Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    planting_record_id: Mapped[int] = mapped_column(ForeignKey("planting_records.id"), nullable=False)
    activity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    activity_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    cost_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    labor_cost_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    planting_record = relationship("PlantingRecord", back_populates="activities")


