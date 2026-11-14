from datetime import date
from decimal import Decimal

from typing import Any

from pydantic import BaseModel, Field, field_validator


class CostBase(BaseModel):
    planting_record_id: int
    cost_type: str = Field(min_length=2, max_length=80)
    amount: Decimal = Field(gt=0)
    cost_date: date
    notes: str | None = None


class CostCreate(CostBase):
    pass


class CostUpdate(BaseModel):
    cost_type: str | None = Field(default=None, min_length=2, max_length=80)
    amount: Decimal | None = Field(default=None, gt=0)
    cost_date: date | None = None
    notes: str | None = None

    @field_validator("cost_type", "amount", "cost_date", mode="before")
    @classmethod
    def reject_null_for_required_fields(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("Field cannot be null")
        return value


class CostRead(CostBase):
    id: int
    user_id: int

    model_config = {"from_attributes": True}


class HarvestBase(BaseModel):
    planting_record_id: int
    harvest_date: date
    quantity: Decimal = Field(gt=0)
    unit: str = Field(min_length=1, max_length=40)
    selling_price_per_unit: Decimal = Field(gt=0)
    notes: str | None = None


class HarvestCreate(HarvestBase):
    pass


class HarvestUpdate(BaseModel):
    harvest_date: date | None = None
    quantity: Decimal | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, min_length=1, max_length=40)
    selling_price_per_unit: Decimal | None = Field(default=None, gt=0)
    notes: str | None = None

    @field_validator("harvest_date", "quantity", "unit", "selling_price_per_unit", mode="before")
    @classmethod
    def reject_null_for_required_fields(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("Field cannot be null")
        return value


class HarvestRead(HarvestBase):
    id: int
    user_id: int
    revenue: Decimal

    model_config = {"from_attributes": True}


class ProfitLossSummary(BaseModel):
    total_cost: Decimal
    total_revenue: Decimal
    profit_loss: Decimal