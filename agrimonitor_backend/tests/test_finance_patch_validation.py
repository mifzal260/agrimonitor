from datetime import date

import pytest
from fastapi.testclient import TestClient


FINANCE_REQUIRED_FIELDS = [
    ("costs", "cost_type"),
    ("costs", "amount"),
    ("costs", "cost_date"),
    ("harvests", "harvest_date"),
    ("harvests", "quantity"),
    ("harvests", "unit"),
    ("harvests", "selling_price_per_unit"),
]


def create_finance_records(client: TestClient) -> tuple[dict[str, str], int, int]:
    registration = client.post(
        "/api/v1/auth/register",
        json={"name": "Finance Patch Tester", "email": "finance-patch@example.com", "password": "password123"},
    )
    assert registration.status_code == 201
    headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}

    planting = client.post(
        "/api/v1/monitoring/planting-records",
        headers=headers,
        json={
            "custom_crop_name": "Finance Test Crop",
            "field_name": "Finance Test Plot",
            "planting_date": date.today().isoformat(),
        },
    )
    assert planting.status_code == 201
    planting_record_id = planting.json()["id"]

    cost = client.post(
        "/api/v1/finance/costs",
        headers=headers,
        json={
            "planting_record_id": planting_record_id,
            "cost_type": "Fertilizer",
            "amount": "12.50",
            "cost_date": date.today().isoformat(),
        },
    )
    assert cost.status_code == 201

    harvest = client.post(
        "/api/v1/finance/harvests",
        headers=headers,
        json={
            "planting_record_id": planting_record_id,
            "harvest_date": date.today().isoformat(),
            "quantity": "10.00",
            "unit": "kg",
            "selling_price_per_unit": "8.00",
        },
    )
    assert harvest.status_code == 201
    return headers, cost.json()["id"], harvest.json()["id"]


@pytest.mark.parametrize(("resource", "field"), FINANCE_REQUIRED_FIELDS)
def test_finance_patch_rejects_null_for_required_columns_and_preserves_record(
    client: TestClient,
    resource: str,
    field: str,
) -> None:
    headers, cost_id, harvest_id = create_finance_records(client)
    record_id = cost_id if resource == "costs" else harvest_id

    response = client.patch(
        f"/api/v1/finance/{resource}/{record_id}",
        headers=headers,
        json={field: None},
    )

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", field]

    updated = client.patch(
        f"/api/v1/finance/{resource}/{record_id}",
        headers=headers,
        json={"notes": "Transaction remains usable"},
    )
    assert updated.status_code == 200
    assert updated.json()["notes"] == "Transaction remains usable"
    assert updated.json()[field] is not None


@pytest.mark.parametrize("resource", ["costs", "harvests"])
def test_finance_patch_preserves_omitted_fields_and_allows_null_notes(
    client: TestClient,
    resource: str,
) -> None:
    headers, cost_id, harvest_id = create_finance_records(client)
    record_id = cost_id if resource == "costs" else harvest_id
    original_response = client.get(f"/api/v1/finance/{resource}", headers=headers)
    original = next(row for row in original_response.json() if row["id"] == record_id)

    response = client.patch(
        f"/api/v1/finance/{resource}/{record_id}",
        headers=headers,
        json={"notes": None},
    )

    assert response.status_code == 200
    assert response.json()["notes"] is None
    assert all(
        response.json()[field] == original[field]
        for field in original
        if field not in {"notes", "updated_at"}
    )
