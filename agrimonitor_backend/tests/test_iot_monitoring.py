from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.models.sensor_reading import SensorReading
from app.services.iot_simulator import SimulationSensorProvider, determine_device_status, get_or_create_demo_device


def register_user(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "IoT Tester", "email": "iot@example.com", "password": "password123"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_simulator_generates_values_in_allowed_ranges(db_session) -> None:
    provider = SimulationSensorProvider()
    reading = provider.generate_reading(db_session)

    assert 24 <= float(reading.temperature) <= 38
    assert 45 <= float(reading.humidity) <= 95
    assert 20 <= float(reading.soil_moisture) <= 90
    assert 0 <= float(reading.light_intensity) <= 1200
    assert 0 <= float(reading.battery_level) <= 100
    assert reading.device.data_source == "simulation"


def test_simulator_changes_are_not_too_abrupt(db_session) -> None:
    provider = SimulationSensorProvider()
    first = provider.generate_reading(db_session)
    second = provider.generate_reading(db_session)

    assert abs(float(second.temperature) - float(first.temperature)) <= 0.4
    assert abs(float(second.humidity) - float(first.humidity)) <= 2.0
    assert abs(float(second.soil_moisture) - float(first.soil_moisture)) <= 1.8
    assert abs(float(second.light_intensity) - float(first.light_intensity)) <= 80.0
    assert float(second.battery_level) <= float(first.battery_level)


def test_latest_endpoint_returns_simulation_structure(client: TestClient) -> None:
    token = register_user(client)
    generated = client.post("/api/v1/monitoring/simulation/generate", headers=auth_header(token))
    assert generated.status_code == 201

    response = client.get("/api/v1/monitoring/sensors/latest", headers=auth_header(token))

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "simulation"
    assert data["device"]["device_code"] == "IOT-DEMO-001"
    assert data["reading"]["temperature"] is not None
    assert data["thresholds"]["temperature_warning_celsius"] == 35


def test_history_endpoint_respects_limit(client: TestClient) -> None:
    token = register_user(client)
    for _ in range(5):
        response = client.post("/api/v1/monitoring/simulation/generate", headers=auth_header(token))
        assert response.status_code == 201

    response = client.get("/api/v1/monitoring/sensors/history?limit=3", headers=auth_header(token))

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "simulation"
    assert len(data["readings"]) == 3


def test_offline_status_is_based_on_last_reading_age(db_session, monkeypatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "iot_offline_after_seconds", 60)
    device = get_or_create_demo_device(db_session)
    reading = SensorReading(
        device_id=device.id,
        temperature=29,
        humidity=70,
        soil_moisture=55,
        light_intensity=500,
        battery_level=80,
        recorded_at=datetime.now(timezone.utc) - timedelta(seconds=120),
    )

    assert determine_device_status(reading) == "offline"


def test_sensor_endpoints_return_404_for_unknown_device(client: TestClient) -> None:
    token = register_user(client)
    headers = auth_header(token)

    latest = client.get("/api/v1/monitoring/sensors/latest?device_id=999", headers=headers)
    history = client.get("/api/v1/monitoring/sensors/history?device_id=999", headers=headers)
    generated = client.post("/api/v1/monitoring/simulation/generate?device_id=999", headers=headers)

    assert latest.status_code == 404
    assert history.status_code == 404
    assert generated.status_code == 404


def test_generate_simulation_is_disabled_in_iot_mode(client: TestClient, monkeypatch) -> None:
    from app.core.config import settings

    token = register_user(client)
    monkeypatch.setattr(settings, "iot_data_mode", "iot")

    response = client.post("/api/v1/monitoring/simulation/generate", headers=auth_header(token))

    assert response.status_code == 409
    assert "IOT_DATA_MODE=simulation" in response.json()["detail"]

def test_iot_monitoring_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/monitoring/sensors/latest")

    assert response.status_code == 401
