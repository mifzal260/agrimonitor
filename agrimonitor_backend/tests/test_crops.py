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


def test_authenticated_user_can_add_shared_crop(
    client: TestClient,
    db_session: Session,
) -> None:
    first_user_headers = register_crop_user(client, "crop-a@example.com")
    response = client.post(
        "/api/v1/monitoring/crops",
        headers=first_user_headers,
        json={"name": "  dragon fruit  "},
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Dragon Fruit"

    second_user_headers = register_crop_user(client, "crop-b@example.com")
    second_user_crops = client.get("/api/v1/monitoring/crops", headers=second_user_headers)

    assert second_user_crops.status_code == 200
    assert any(crop["id"] == response.json()["id"] for crop in second_user_crops.json())
    assert db_session.scalar(select(func.count()).select_from(Crop)) == 1


def test_adding_existing_crop_name_reuses_shared_crop(
    client: TestClient,
    db_session: Session,
) -> None:
    headers = register_crop_user(client, "crop-duplicate@example.com")
    original = client.post(
        "/api/v1/monitoring/crops",
        headers=headers,
        json={"name": "Sweet Corn"},
    )
    duplicate = client.post(
        "/api/v1/monitoring/crops",
        headers=headers,
        json={"name": " sweet corn "},
    )

    assert original.status_code == duplicate.status_code == 201
    assert duplicate.json()["id"] == original.json()["id"]
    assert db_session.scalar(select(func.count()).select_from(Crop)) == 1


def test_adding_crop_requires_authentication(client: TestClient) -> None:
    response = client.post("/api/v1/monitoring/crops", json={"name": "Dragon Fruit"})

    assert response.status_code == 401
