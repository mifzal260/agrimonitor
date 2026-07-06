from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.mixins import TimestampMixin


class MarketPrice(TimestampMixin, Base):
    __tablename__ = "market_prices"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    crop_id: Mapped[int | None] = mapped_column(ForeignKey("crops.id"))
    commodity_name: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str] = mapped_column(String(120), nullable=False)
    price_type: Mapped[str] = mapped_column(String(40), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(40), nullable=False)
    recorded_date: Mapped[date] = mapped_column(Date, nullable=False)
    trend: Mapped[str] = mapped_column(String(20), nullable=False, default="stable")

    crop = relationship("Crop", back_populates="market_prices")