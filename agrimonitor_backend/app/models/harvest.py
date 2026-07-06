from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.mixins import TimestampMixin


class Harvest(TimestampMixin, Base):
    __tablename__ = "harvests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True, nullable=False)
    planting_record_id: Mapped[int] = mapped_column(ForeignKey("planting_records.id"), nullable=False)
    harvest_date: Mapped[date] = mapped_column(Date, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(40), nullable=False)
    selling_price_per_unit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    revenue: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    planting_record = relationship("PlantingRecord", back_populates="harvests")