from datetime import UTC, date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.crop import Crop
from app.models.symptom import Symptom

PATCH_REQUIRED_FIELDS = [
    ("planting", "crop_id"),
    ("planting", "field_name"),
    ("planting", "planting_date"),
    ("planting", "status"),
    ("activity", "activity_type"),
    ("activity", "activity_date"),
    ("symptom", "severity"),
    ("symptom", "observed_at"),
    ("symptom", "status"),
]


def create_patch_entities(client: TestClient, db_session: Session) -> dict[str, object]:
    registration = client.post(
        "/api/v1/auth/register",
        json={"name": "Patch Tester", "email": "patch@example.com", "password": "password123"},
    )
    assert registration.status_code == 201
    headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}

    crop = Crop(name="Patch Test Crop", expected_harvest_days=90)
    symptom = Symptom(name="Patch Test Symptom")
    db_session.add_all([crop, symptom])
    db_session.commit()

    planting = client.post(
        "/api/v1/monitoring/planting-records",
        headers=headers,
        json={
            "crop_id": crop.id,
            "field_name": "Patch Plot",
            "planting_date": date.today().isoformat(),
            "area_size": "1.25",
            "status": "healthy",
            "notes": "Original planting notes",
        },
    )
    assert planting.status_code == 201

    activity = client.post(
        "/api/v1/monitoring/activities",
        headers=headers,
        json={
            "planting_record_id": planting.json()["id"],
            "activity_type": "Fertilizing",
            "activity_date": date.today().isoformat(),
            "description": "Original activity description",
            "cost_amount": "12.50",
            "labor_cost_amount": "4.00",
        },
    )
    assert activity.status_code == 201

    symptom_record = client.post(
        "/api/v1/monitoring/symptom-records",
        headers=headers,
        json={
            "planting_record_id": planting.json()["id"],
            "symptom_id": symptom.id,
            "severity": "medium",
            "notes": "Original symptom notes",
            "image_url": "https://example.com/leaf.jpg",
            "observed_at": datetime.now(UTC).isoformat(),
            "status": "active",
            "resolved_at": datetime.now(UTC).isoformat(),
        },
    )
    assert symptom_record.status_code == 201

    return {
        "headers": headers,
        "planting": planting.json(),
        "activity": activity.json(),
        "symptom": symptom_record.json(),
    }


def patch_url(resource: str, entities: dict[str, object]) -> str:
    record = entities[resource]
    assert isinstance(record, dict)
    route = {
        "planting": "planting-records",
        "activity": "activities",
        "symptom": "symptom-records",
    }[resource]
    return f"/api/v1/monitoring/{route}/{record['id']}"


@pytest.mark.parametrize(("resource", "field"), PATCH_REQUIRED_FIELDS)
def test_patch_rejects_null_for_required_fields(
    client: TestClient,
    db_session: Session,
    resource: str,
    field: str,
) -> None:
    entities = create_patch_entities(client, db_session)
    response = client.patch(
        patch_url(resource, entities),
        headers=entities["headers"],
        json={field: None},
    )

    assert response.status_code == 422
    assert any(
        error["loc"] == ["body", field]
        for error in response.json()["detail"]
    )


@pytest.mark.parametrize(
    ("resource", "nullable_fields"),
    [
        ("planting", {"area_size": None, "notes": None}),
        ("activity", {"description": None, "cost_amount": None, "labor_cost_amount": None}),
        ("symptom", {"notes": None, "image_url": None, "resolved_at": None}),
    ],
)
def test_patch_allows_null_for_nullable_fields(
    client: TestClient,
    db_session: Session,
    resource: str,
    nullable_fields: dict[str, None],
) -> None:
    entities = create_patch_entities(client, db_session)
    response = client.patch(
        patch_url(resource, entities),
        headers=entities["headers"],
        json=nullable_fields,
    )

    assert response.status_code == 200
    assert all(response.json()[field] is None for field in nullable_fields)


@pytest.mark.parametrize(
    ("resource", "unchanged_field"),
    [
        ("planting", "field_name"),
        ("activity", "activity_type"),
        ("symptom", "severity"),
    ],
)
def test_empty_patch_does_not_overwrite_existing_fields(
    client: TestClient,
    db_session: Session,
    resource: str,
    unchanged_field: str,
) -> None:
    entities = create_patch_entities(client, db_session)
    original = entities[resource]
    assert isinstance(original, dict)
    response = client.patch(
        patch_url(resource, entities),
        headers=entities["headers"],
        json={},
    )

    assert response.status_code == 200
    assert response.json()[unchanged_field] == original[unchanged_field]
