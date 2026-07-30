from __future__ import annotations

import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.iot_device import IotDevice
from app.models.sensor_reading import SensorReading

DEMO_DEVICE_CODE = "IOT-DEMO-001"

RANGES = {
    "temperature": (24.0, 38.0),
    "humidity": (45.0, 95.0),
    "soil_moisture": (20.0, 90.0),
    "light_intensity": (0.0, 1200.0),
    "battery_level": (0.0, 100.0),
}

DELTAS = {
    "temperature": 0.4,
    "humidity": 2.0,
    "soil_moisture": 1.8,
    "light_intensity": 80.0,
    "battery_level": 0.3,
}

DEFAULT_VALUES = {
    "temperature": 29.0,
    "humidity": 72.0,
    "soil_moisture": 58.0,
    "light_intensity": 640.0,
    "battery_level": 86.0,
}


class SensorDataProvider(Protocol):
    def get_latest_reading(self, db: Session, device_id: int | None = None) -> SensorReading | None:
        ...

    def generate_reading(self, db: Session, device_id: int | None = None) -> SensorReading:
        ...


@dataclass
class SimulationSensorProvider:
    randomizer: random.Random = random.Random()

    def get_latest_reading(self, db: Session, device_id: int | None = None) -> SensorReading | None:
        device = get_or_create_demo_device(db) if device_id is None else db.get(IotDevice, device_id)
        if not device:
            return None
        return get_latest_reading(db, device.id)

    def generate_reading(self, db: Session, device_id: int | None = None) -> SensorReading:
        device = get_or_create_demo_device(db) if device_id is None else db.get(IotDevice, device_id)
        if not device:
            device = get_or_create_demo_device(db)

        latest = get_latest_reading(db, device.id)
        values = build_next_values(latest, self.randomizer)
        reading = SensorReading(device_id=device.id, recorded_at=datetime.now(timezone.utc), **values)
        device.data_source = "simulation"
        device.status = determine_device_status(reading)
        db.add(reading)
        db.commit()
        db.refresh(reading)
        db.refresh(device)
        return reading


class IoTSensorProvider:
    def get_latest_reading(self, db: Session, device_id: int | None = None) -> SensorReading | None:
        device = get_or_create_demo_device(db) if device_id is None else db.get(IotDevice, device_id)
        if not device:
            return None
        return get_latest_reading(db, device.id)

    def generate_reading(self, db: Session, device_id: int | None = None) -> SensorReading:
        raise NotImplementedError("Real IoT provider is not implemented yet")


def get_sensor_provider() -> SensorDataProvider:
    if settings.iot_data_mode == "iot":
        return IoTSensorProvider()
    return SimulationSensorProvider()


def get_or_create_demo_device(db: Session) -> IotDevice:
    device = db.scalar(select(IotDevice).where(IotDevice.device_code == DEMO_DEVICE_CODE))
    if device:
        return device

    device = IotDevice(
        device_code=DEMO_DEVICE_CODE,
        device_name="AgriMonitor Demo Sensor",
        location="Plot A",
        data_source="simulation",
        status="online",
        is_active=True,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


def list_devices(db: Session) -> list[IotDevice]:
    if settings.iot_data_mode == "simulation":
        get_or_create_demo_device(db)
    devices = db.scalars(select(IotDevice).order_by(IotDevice.device_name)).all()
    for device in devices:
        latest = get_latest_reading(db, device.id)
        device.status = determine_device_status(latest)
    db.commit()
    return list(devices)


def get_device(db: Session, device_id: int) -> IotDevice | None:
    device = db.get(IotDevice, device_id)
    if not device:
        return None
    latest = get_latest_reading(db, device.id)
    device.status = determine_device_status(latest)
    db.commit()
    db.refresh(device)
    return device


def get_latest_reading(db: Session, device_id: int) -> SensorReading | None:
    return db.scalar(
        select(SensorReading)
        .where(SensorReading.device_id == device_id)
        .order_by(SensorReading.recorded_at.desc(), SensorReading.id.desc())
    )


def list_sensor_history(
    db: Session,
    *,
    device_id: int | None,
    from_at: datetime | None,
    to_at: datetime | None,
    limit: int,
) -> tuple[IotDevice | None, list[SensorReading]]:
    device = get_or_create_demo_device(db) if device_id is None and settings.iot_data_mode == "simulation" else None
    if device_id is not None:
        device = db.get(IotDevice, device_id)
    if not device:
        return None, []

    statement = select(SensorReading).where(SensorReading.device_id == device.id)
    if from_at:
        statement = statement.where(SensorReading.recorded_at >= from_at)
    if to_at:
        statement = statement.where(SensorReading.recorded_at <= to_at)
    readings = db.scalars(statement.order_by(SensorReading.recorded_at.desc()).limit(limit)).all()
    return device, list(reversed(readings))


def build_latest_response(db: Session, device_id: int | None = None) -> tuple[IotDevice | None, SensorReading | None]:
    device = get_or_create_demo_device(db) if device_id is None and settings.iot_data_mode == "simulation" else None
    if device_id is not None:
        device = db.get(IotDevice, device_id)
    if not device:
        return None, None
    latest = get_latest_reading(db, device.id)
    device.status = determine_device_status(latest)
    db.commit()
    db.refresh(device)
    return device, latest


def build_next_values(latest: SensorReading | None, randomizer: random.Random) -> dict[str, Decimal]:
    values: dict[str, Decimal] = {}
    for metric, default_value in DEFAULT_VALUES.items():
        previous = float(getattr(latest, metric)) if latest else default_value
        delta = randomizer.uniform(-DELTAS[metric], DELTAS[metric])
        if metric == "battery_level":
            delta = -abs(delta)
        values[metric] = to_decimal(clamp(previous + delta, *RANGES[metric]))
    return values


def determine_device_status(reading: SensorReading | None) -> str:
    if not reading:
        return "offline"
    now = datetime.now(timezone.utc)
    recorded_at = reading.recorded_at
    if recorded_at.tzinfo is None:
        recorded_at = recorded_at.replace(tzinfo=timezone.utc)
    age = now - recorded_at
    if age > timedelta(seconds=settings.iot_offline_after_seconds):
        return "offline"
    if age > timedelta(seconds=settings.iot_online_after_seconds) or build_alerts(reading):
        return "warning"
    return "online"


def build_alerts(reading: SensorReading | None) -> list[dict[str, str]]:
    if not reading:
        return [{"metric": "connection", "level": "danger", "message": "Tiada bacaan sensor tersedia."}]

    alerts: list[dict[str, str]] = []
    if float(reading.temperature) > settings.iot_temperature_warning_celsius:
        alerts.append({"metric": "temperature", "level": "warning", "message": "Suhu udara melebihi had amaran."})
    if float(reading.soil_moisture) < settings.iot_soil_moisture_warning_percent:
        alerts.append({"metric": "soil_moisture", "level": "warning", "message": "Kelembapan tanah rendah."})
    if float(reading.battery_level) < settings.iot_battery_warning_percent:
        alerts.append({"metric": "battery_level", "level": "warning", "message": "Bateri peranti rendah."})
    if determine_age_status(reading) == "offline":
        alerts.append({"metric": "connection", "level": "danger", "message": "Tiada bacaan baharu melebihi tempoh offline."})
    return alerts


def determine_age_status(reading: SensorReading) -> str:
    recorded_at = reading.recorded_at
    if recorded_at.tzinfo is None:
        recorded_at = recorded_at.replace(tzinfo=timezone.utc)
    age_seconds = (datetime.now(timezone.utc) - recorded_at).total_seconds()
    if age_seconds > settings.iot_offline_after_seconds:
        return "offline"
    if age_seconds > settings.iot_online_after_seconds:
        return "warning"
    return "online"


def thresholds() -> dict[str, int]:
    return {
        "temperature_warning_celsius": settings.iot_temperature_warning_celsius,
        "soil_moisture_warning_percent": settings.iot_soil_moisture_warning_percent,
        "battery_warning_percent": settings.iot_battery_warning_percent,
        "online_after_seconds": settings.iot_online_after_seconds,
        "offline_after_seconds": settings.iot_offline_after_seconds,
    }


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(max(value, minimum), maximum)


def to_decimal(value: float) -> Decimal:
    return Decimal(str(round(value, 2)))
