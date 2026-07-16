from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.crop import Crop


def auth_header(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Owner Test", "email": email, "password": "password123"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_crop(db_session: Session) -> Crop:
    crop = Crop(name="Cili Test", variety="F.A.Q", description="Test crop", expected_harvest_days=90)
    db_session.add(crop)
    db_session.commit()
    db_session.refresh(crop)
    return crop


def create_planting_record(client: TestClient, headers: dict[str, str], crop_id: int, field_name: str) -> dict:
    response = client.post(
        "/api/v1/monitoring/planting-records",
        headers=headers,
        json={
            "crop_id": crop_id,
            "field_name": field_name,
            "planting_date": date.today().isoformat(),
            "area_size": "0.25",
            "status": "healthy",
            "notes": "Ownership test",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_user_can_read_own_planting_record(client: TestClient, db_session: Session) -> None:
    crop = create_crop(db_session)
    user_a = auth_header(client, "owner-a@example.com")
    record_a = create_planting_record(client, user_a, crop.id, "Plot A")

    response = client.get(f"/api/v1/monitoring/planting-records/{record_a['id']}", headers=user_a)

    assert response.status_code == 200
    assert response.json()["field_name"] == "Plot A"


def test_user_cannot_read_update_or_delete_other_users_planting_record(
    client: TestClient,
    db_session: Session,
) -> None:
    crop = create_crop(db_session)
    user_a = auth_header(client, "owner-a@example.com")
    user_b = auth_header(client, "owner-b@example.com")
    record_b = create_planting_record(client, user_b, crop.id, "Plot B")

    read_response = client.get(f"/api/v1/monitoring/planting-records/{record_b['id']}", headers=user_a)
    update_response = client.patch(
        f"/api/v1/monitoring/planting-records/{record_b['id']}",
        headers=user_a,
        json={"field_name": "Hijacked Plot"},
    )
    delete_response = client.delete(f"/api/v1/monitoring/planting-records/{record_b['id']}", headers=user_a)
    owner_read_response = client.get(f"/api/v1/monitoring/planting-records/{record_b['id']}", headers=user_b)

    assert read_response.status_code == 404
    assert update_response.status_code == 404
    assert delete_response.status_code == 404
    assert owner_read_response.status_code == 200
    assert owner_read_response.json()["field_name"] == "Plot B"
