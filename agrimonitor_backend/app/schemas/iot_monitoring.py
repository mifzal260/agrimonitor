from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class IotDeviceRead(BaseModel):
    id: int
    device_code: str
    device_name: str
    location: str
    data_source: str
    status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class IotDeviceSummary(BaseModel):
    id: int
    device_code: str
    device_name: str
    location: str
    data_source: str
    status: str

    model_config = {"from_attributes": True}


class SensorReadingRead(BaseModel):
    id: int
    device_id: int
    temperature: Decimal
    humidity: Decimal
    soil_moisture: Decimal
    light_intensity: Decimal
    battery_level: Decimal
    recorded_at: datetime

    model_config = {"from_attributes": True}


class MonitoringAlert(BaseModel):
    metric: str
    level: str
    message: str


class SensorThresholds(BaseModel):
    temperature_warning_celsius: int
    soil_moisture_warning_percent: int
    battery_warning_percent: int
    online_after_seconds: int
    offline_after_seconds: int


class LatestSensorResponse(BaseModel):
    mode: str
    device: IotDeviceSummary | None
    reading: SensorReadingRead | None
    alerts: list[MonitoringAlert] = Field(default_factory=list)
    thresholds: SensorThresholds


class SensorHistoryResponse(BaseModel):
    mode: str
    device: IotDeviceSummary | None
    readings: list[SensorReadingRead]
    limit: int
