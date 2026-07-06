from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class MarketPriceBase(BaseModel):
    crop_id: int | None = None
    commodity_name: str = Field(min_length=2, max_length=120)
    location: str = Field(min_length=2, max_length=120)
    price_type: str = Field(min_length=2, max_length=40)
    price: Decimal = Field(gt=0)
    unit: str = Field(min_length=1, max_length=40)
    recorded_date: date
    trend: str = Field(default="stable", max_length=20)


class MarketPriceCreate(MarketPriceBase):
    pass


class MarketPriceUpdate(BaseModel):
    crop_id: int | None = None
    commodity_name: str | None = Field(default=None, min_length=2, max_length=120)
    location: str | None = Field(default=None, min_length=2, max_length=120)
    price_type: str | None = Field(default=None, min_length=2, max_length=40)
    price: Decimal | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, min_length=1, max_length=40)
    recorded_date: date | None = None
    trend: str | None = Field(default=None, max_length=20)


class MarketPriceRead(MarketPriceBase):
    id: int

    model_config = {"from_attributes": True}


class CsvImportResult(BaseModel):
    imported: int
    skipped: int