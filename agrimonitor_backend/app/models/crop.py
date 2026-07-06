from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.models.mixins import TimestampMixin


class Crop(TimestampMixin, Base):
    __tablename__ = "crops"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    variety: Mapped[str | None] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    expected_harvest_days: Mapped[int | None] = mapped_column(Integer)

    disease_rules = relationship("DiseaseRule", back_populates="crop")
    planting_records = relationship("PlantingRecord", back_populates="crop")
    market_prices = relationship("MarketPrice", back_populates="crop")