from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.crop import Crop


def register_crop_user(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Crop User", "email": email, "password": "password123"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_record(client: TestClient, headers: dict[str, str], crop_payload: dict) -> dict:
    response = client.post(
        "/api/v1/monitoring/planting-records",
        headers=headers,
        json={
            **crop_payload,
            "field_name": "Test Plot",
            "planting_date": date.today().isoformat(),
            "status": "healthy",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_custom_crop_stays_on_planting_record_and_out_of_shared_catalog(
    client: TestClient,
    db_session: Session,
) -> None:
    shared_crop = Crop(name="Tomato")
    db_session.add(shared_crop)
    db_session.commit()
    first_user_headers = register_crop_user(client, "crop-private-a@example.com")
    second_user_headers = register_crop_user(client, "crop-private-b@example.com")

    record = create_record(
        client,
        first_user_headers,
        {"crop_id": None, "custom_crop_name": "  dragon fruit  "},
    )

    assert record["crop_id"] is None
    assert record["custom_crop_name"] == "Dragon Fruit"
    assert record["crop"] is None
    first_user_records = client.get("/api/v1/monitoring/planting-records", headers=first_user_headers)
    assert first_user_records.json()[0]["custom_crop_name"] == "Dragon Fruit"
    evaluation = client.post(
        f"/api/v1/recommendations/planting-records/{record['id']}/evaluate",
        headers=first_user_headers,
    )
    assert evaluation.status_code == 200
    assert evaluation.json()["matches"] == []

    for headers in (first_user_headers, second_user_headers):
        catalog_response = client.get("/api/v1/monitoring/crops", headers=headers)
        assert catalog_response.status_code == 200
        assert [crop["name"] for crop in catalog_response.json()] == ["Tomato"]
    assert db_session.scalar(select(func.count()).select_from(Crop)) == 1


def test_catalog_crop_planting_records_remain_supported(
    client: TestClient,
    db_session: Session,
) -> None:
    crop = Crop(name="Tomato")
    db_session.add(crop)
    db_session.commit()
    headers = register_crop_user(client, "crop-catalog@example.com")

    record = create_record(client, headers, {"crop_id": crop.id})

    assert record["crop_id"] == crop.id
    assert record["custom_crop_name"] is None
    assert record["crop"]["name"] == "Tomato"


def test_custom_crop_can_be_edited_without_creating_catalog_entry(
    client: TestClient,
    db_session: Session,
) -> None:
    crop = Crop(name="Tomato")
    db_session.add(crop)
    db_session.commit()
    headers = register_crop_user(client, "crop-edit@example.com")
    record = create_record(client, headers, {"crop_id": crop.id})

    response = client.patch(
        f"/api/v1/monitoring/planting-records/{record['id']}",
        headers=headers,
        json={"crop_id": None, "custom_crop_name": "sweet corn"},
    )

    assert response.status_code == 200
    assert response.json()["crop_id"] is None
    assert response.json()["custom_crop_name"] == "Sweet Corn"
    assert response.json()["crop"] is None
    assert db_session.scalar(select(func.count()).select_from(Crop)) == 1

    empty_patch = client.patch(
        f"/api/v1/monitoring/planting-records/{record['id']}",
        headers=headers,
        json={},
    )
    assert empty_patch.status_code == 200
    assert empty_patch.json()["custom_crop_name"] == "Sweet Corn"

    catalog_patch = client.patch(
        f"/api/v1/monitoring/planting-records/{record['id']}",
        headers=headers,
        json={"crop_id": crop.id, "custom_crop_name": None},
    )
    assert catalog_patch.status_code == 200
    assert catalog_patch.json()["custom_crop_name"] is None
    assert catalog_patch.json()["crop"]["name"] == "Tomato"


def test_planting_record_requires_authentication_for_custom_crop(client: TestClient) -> None:
    response = client.post(
        "/api/v1/monitoring/planting-records",
        json={
            "custom_crop_name": "Dragon Fruit",
            "field_name": "Test Plot",
            "planting_date": date.today().isoformat(),
        },
    )

    assert response.status_code == 401
