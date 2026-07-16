from datetime import UTC, date, datetime

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.crop import Crop
from app.models.symptom import Symptom


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


def create_symptom(db_session: Session) -> Symptom:
    symptom = Symptom(name="Leaf Spot Test", description="Test symptom")
    db_session.add(symptom)
    db_session.commit()
    db_session.refresh(symptom)
    return symptom


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


def setup_two_users_with_records(client: TestClient, db_session: Session) -> tuple[dict[str, str], dict[str, str], dict, dict]:
    crop = create_crop(db_session)
    user_a = auth_header(client, "owner-a@example.com")
    user_b = auth_header(client, "owner-b@example.com")
    record_a = create_planting_record(client, user_a, crop.id, "Plot A")
    record_b = create_planting_record(client, user_b, crop.id, "Plot B")
    return user_a, user_b, record_a, record_b


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
    user_a, user_b, _record_a, record_b = setup_two_users_with_records(client, db_session)

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


def test_user_cannot_update_or_delete_other_users_activity(client: TestClient, db_session: Session) -> None:
    user_a, user_b, _record_a, record_b = setup_two_users_with_records(client, db_session)
    created = client.post(
        "/api/v1/monitoring/activities",
        headers=user_b,
        json={
            "planting_record_id": record_b["id"],
            "activity_type": "Membaja",
            "activity_date": date.today().isoformat(),
            "cost_amount": "10.00",
            "labor_cost_amount": "5.00",
        },
    )
    assert created.status_code == 201
    activity_id = created.json()["id"]

    list_response = client.get("/api/v1/monitoring/activities", headers=user_a)
    update_response = client.patch(f"/api/v1/monitoring/activities/{activity_id}", headers=user_a, json={"activity_type": "Hijack"})
    delete_response = client.delete(f"/api/v1/monitoring/activities/{activity_id}", headers=user_a)
    owner_list_response = client.get("/api/v1/monitoring/activities", headers=user_b)

    assert list_response.status_code == 200
    assert list_response.json() == []
    assert update_response.status_code == 404
    assert delete_response.status_code == 404
    assert len(owner_list_response.json()) == 1


def test_user_cannot_update_or_delete_other_users_symptom_record(client: TestClient, db_session: Session) -> None:
    user_a, user_b, _record_a, record_b = setup_two_users_with_records(client, db_session)
    symptom = create_symptom(db_session)
    created = client.post(
        "/api/v1/monitoring/symptom-records",
        headers=user_b,
        json={
            "planting_record_id": record_b["id"],
            "symptom_id": symptom.id,
            "severity": "medium",
            "observed_at": datetime.now(UTC).isoformat(),
            "status": "active",
        },
    )
    assert created.status_code == 201
    symptom_record_id = created.json()["id"]

    list_response = client.get("/api/v1/monitoring/symptom-records", headers=user_a)
    update_response = client.patch(f"/api/v1/monitoring/symptom-records/{symptom_record_id}", headers=user_a, json={"status": "resolved"})
    delete_response = client.delete(f"/api/v1/monitoring/symptom-records/{symptom_record_id}", headers=user_a)
    owner_list_response = client.get("/api/v1/monitoring/symptom-records", headers=user_b)

    assert list_response.status_code == 200
    assert list_response.json() == []
    assert update_response.status_code == 404
    assert delete_response.status_code == 404
    assert len(owner_list_response.json()) == 1


def test_user_cannot_update_or_delete_other_users_cost(client: TestClient, db_session: Session) -> None:
    user_a, user_b, _record_a, record_b = setup_two_users_with_records(client, db_session)
    created = client.post(
        "/api/v1/finance/costs",
        headers=user_b,
        json={
            "planting_record_id": record_b["id"],
            "cost_type": "Baja tambahan",
            "amount": "20.00",
            "cost_date": date.today().isoformat(),
        },
    )
    assert created.status_code == 201
    cost_id = created.json()["id"]

    list_response = client.get("/api/v1/finance/costs", headers=user_a)
    update_response = client.patch(f"/api/v1/finance/costs/{cost_id}", headers=user_a, json={"amount": "30.00"})
    delete_response = client.delete(f"/api/v1/finance/costs/{cost_id}", headers=user_a)
    owner_list_response = client.get("/api/v1/finance/costs", headers=user_b)

    assert list_response.status_code == 200
    assert list_response.json() == []
    assert update_response.status_code == 404
    assert delete_response.status_code == 404
    assert len(owner_list_response.json()) == 1


def test_user_cannot_update_or_delete_other_users_harvest(client: TestClient, db_session: Session) -> None:
    user_a, user_b, _record_a, record_b = setup_two_users_with_records(client, db_session)
    created = client.post(
        "/api/v1/finance/harvests",
        headers=user_b,
        json={
            "planting_record_id": record_b["id"],
            "harvest_date": date.today().isoformat(),
            "quantity": "10.00",
            "unit": "kg",
            "selling_price_per_unit": "8.00",
        },
    )
    assert created.status_code == 201
    harvest_id = created.json()["id"]

    list_response = client.get("/api/v1/finance/harvests", headers=user_a)
    update_response = client.patch(f"/api/v1/finance/harvests/{harvest_id}", headers=user_a, json={"quantity": "12.00"})
    delete_response = client.delete(f"/api/v1/finance/harvests/{harvest_id}", headers=user_a)
    owner_list_response = client.get("/api/v1/finance/harvests", headers=user_b)

    assert list_response.status_code == 200
    assert list_response.json() == []
    assert update_response.status_code == 404
    assert delete_response.status_code == 404
    assert len(owner_list_response.json()) == 1
