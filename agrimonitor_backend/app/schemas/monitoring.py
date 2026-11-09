from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.core.enums import PlantingStatus, SymptomRecordStatus, SymptomSeverity


class CropRead(BaseModel):
    id: int
    name: str
    variety: str | None = None
    description: str | None = None
    expected_harvest_days: int | None = None

    model_config = {"from_attributes": True}


class CropCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)

    @field_validator("name", mode="before")
    @classmethod
    def strip_crop_name(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        return " ".join(
            "-".join(part[:1].upper() + part[1:] for part in word.split("-"))
            for word in value.strip().split()
        )


class SymptomRead(BaseModel):
    id: int
    name: str
    description: str | None = None

    model_config = {"from_attributes": True}


class PlantingRecordBase(BaseModel):
    crop_id: int
    field_name: str = Field(min_length=2, max_length=120)
    planting_date: date
    area_size: Decimal | None = Field(default=None, ge=0)
    status: PlantingStatus = "healthy"
    notes: str | None = None


class PlantingRecordCreate(PlantingRecordBase):
    pass


class PlantingRecordUpdate(BaseModel):
    crop_id: int | None = None
    field_name: str | None = Field(default=None, min_length=2, max_length=120)
    planting_date: date | None = None
    area_size: Decimal | None = Field(default=None, ge=0)
    status: PlantingStatus | None = None
    notes: str | None = None

    @field_validator("crop_id", "field_name", "planting_date", "status", mode="before")
    @classmethod
    def reject_null_for_required_fields(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("Field cannot be null")
        return value


class PlantingRecordRead(PlantingRecordBase):
    id: int
    user_id: int
    plant_age_days: int
    crop: CropRead

    model_config = {"from_attributes": True}


class ActivityBase(BaseModel):
    planting_record_id: int
    activity_type: str = Field(min_length=2, max_length=80)
    activity_date: date
    description: str | None = None
    cost_amount: Decimal | None = Field(default=None, ge=0)
    labor_cost_amount: Decimal | None = Field(default=None, ge=0)


class ActivityCreate(ActivityBase):
    pass


class ActivityUpdate(BaseModel):
    activity_type: str | None = Field(default=None, min_length=2, max_length=80)
    activity_date: date | None = None
    description: str | None = None
    cost_amount: Decimal | None = Field(default=None, ge=0)
    labor_cost_amount: Decimal | None = Field(default=None, ge=0)

    @field_validator("activity_type", "activity_date", mode="before")
    @classmethod
    def reject_null_for_required_fields(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("Field cannot be null")
        return value


class ActivityRead(ActivityBase):
    id: int
    user_id: int

    model_config = {"from_attributes": True}


class SymptomRecordBase(BaseModel):
    planting_record_id: int
    symptom_id: int
    severity: SymptomSeverity
    notes: str | None = None
    image_url: str | None = Field(default=None, max_length=500)
    observed_at: datetime
    status: SymptomRecordStatus = "active"
    resolved_at: datetime | None = None


class SymptomRecordCreate(SymptomRecordBase):
    pass


class SymptomRecordUpdate(BaseModel):
    severity: SymptomSeverity | None = None
    notes: str | None = None
    image_url: str | None = Field(default=None, max_length=500)
    observed_at: datetime | None = None
    status: SymptomRecordStatus | None = None
    resolved_at: datetime | None = None

    @field_validator("severity", "observed_at", "status", mode="before")
    @classmethod
    def reject_null_for_required_fields(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("Field cannot be null")
        return value


class SymptomRecordRead(SymptomRecordBase):
    id: int
    user_id: int
    symptom: SymptomRead

    model_config = {"from_attributes": True}
