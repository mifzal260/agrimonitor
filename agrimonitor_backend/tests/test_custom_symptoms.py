from datetime import UTC, datetime, date

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.crop import Crop
from app.models.symptom import Symptom


def register_user(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Symptom User", "email": email, "password": "password123"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_planting_record(client: TestClient, headers: dict[str, str], crop_id: int) -> dict:
    response = client.post(
        "/api/v1/monitoring/planting-records",
        headers=headers,
        json={
            "crop_id": crop_id,
            "field_name": "Test Plot",
            "planting_date": date.today().isoformat(),
        },
    )
    assert response.status_code == 201
    return response.json()


def test_custom_symptom_is_saved_to_record_not_shared_catalog(
    client: TestClient,
    db_session: Session,
) -> None:
    crop = Crop(name="Tomato")
    symptom = Symptom(name="Yellow leaves")
    db_session.add_all([crop, symptom])
    db_session.commit()
    headers = register_user(client, "custom-symptom@example.com")
    planting = create_planting_record(client, headers, crop.id)

    response = client.post(
        "/api/v1/monitoring/symptom-records",
        headers=headers,
        json={
            "planting_record_id": planting["id"],
            "symptom_id": None,
            "custom_symptom_name": "  leaf blight  ",
            "severity": "medium",
            "observed_at": datetime.now(UTC).isoformat(),
        },
    )

    assert response.status_code == 201
    record = response.json()
    assert record["symptom_id"] is None
    assert record["custom_symptom_name"] == "Leaf Blight"
    assert record["symptom"] is None
    assert db_session.scalar(select(func.count()).select_from(Symptom)) == 1

    listed = client.get("/api/v1/monitoring/symptom-records", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["custom_symptom_name"] == "Leaf Blight"

    evaluation = client.post(
        f"/api/v1/recommendations/planting-records/{planting['id']}/evaluate",
        headers=headers,
    )
    assert evaluation.status_code == 200
    assert evaluation.json()["matches"] == []


def test_catalog_symptom_records_remain_supported(
    client: TestClient,
    db_session: Session,
) -> None:
    crop = Crop(name="Tomato")
    symptom = Symptom(name="Yellow leaves")
    db_session.add_all([crop, symptom])
    db_session.commit()
    headers = register_user(client, "catalog-symptom@example.com")
    planting = create_planting_record(client, headers, crop.id)

    response = client.post(
        "/api/v1/monitoring/symptom-records",
        headers=headers,
        json={
            "planting_record_id": planting["id"],
            "symptom_id": symptom.id,
            "severity": "low",
            "observed_at": datetime.now(UTC).isoformat(),
        },
    )

    assert response.status_code == 201
    assert response.json()["custom_symptom_name"] is None
    assert response.json()["symptom"]["name"] == "Yellow leaves"


def test_symptom_record_requires_exactly_one_catalog_or_custom_symptom(
    client: TestClient,
    db_session: Session,
) -> None:
    crop = Crop(name="Tomato")
    symptom = Symptom(name="Yellow leaves")
    db_session.add_all([crop, symptom])
    db_session.commit()
    headers = register_user(client, "symptom-source@example.com")
    planting = create_planting_record(client, headers, crop.id)
    base_payload = {
        "planting_record_id": planting["id"],
        "severity": "low",
        "observed_at": datetime.now(UTC).isoformat(),
    }

    missing = client.post(
        "/api/v1/monitoring/symptom-records",
        headers=headers,
        json=base_payload,
    )
    both = client.post(
        "/api/v1/monitoring/symptom-records",
        headers=headers,
        json={
            **base_payload,
            "symptom_id": symptom.id,
            "custom_symptom_name": "Leaf Blight",
        },
    )

    assert missing.status_code == 422
    assert both.status_code == 422
