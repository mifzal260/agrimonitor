from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.core.enums import PriceTrend, PriceType


class MarketPriceBase(BaseModel):
    crop_id: int | None = None
    commodity_name: str = Field(min_length=2, max_length=120)
    location: str = Field(min_length=2, max_length=120)
    price_type: PriceType
    price: Decimal = Field(gt=0)
    unit: str = Field(min_length=1, max_length=40)
    recorded_date: date
    trend: PriceTrend = "stable"


class MarketPriceCreate(MarketPriceBase):
    pass


class MarketPriceUpdate(BaseModel):
    crop_id: int | None = None
    commodity_name: str | None = Field(default=None, min_length=2, max_length=120)
    location: str | None = Field(default=None, min_length=2, max_length=120)
    price_type: PriceType | None = None
    price: Decimal | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, min_length=1, max_length=40)
    recorded_date: date | None = None
    trend: PriceTrend | None = None


class MarketPriceRead(MarketPriceBase):
    id: int

    model_config = {"from_attributes": True}


class CsvImportResult(BaseModel):
    imported: int
    skipped: int
