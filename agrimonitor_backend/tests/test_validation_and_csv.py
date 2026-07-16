from io import BytesIO

from fastapi.testclient import TestClient


def admin_header(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Admin", "email": "admin@example.com", "password": "password123"},
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_market_price_rejects_invalid_price_type(client: TestClient) -> None:
    headers = admin_header(client)

    response = client.post(
        "/api/v1/market-prices",
        headers=headers,
        json={
            "commodity_name": "Cili Hijau",
            "location": "Malaysia",
            "price_type": "invalid",
            "price": "10.00",
            "unit": "kg",
            "recorded_date": "2026-07-16",
            "trend": "stable",
        },
    )

    assert response.status_code == 422


def test_planting_record_rejects_invalid_status(client: TestClient) -> None:
    headers = admin_header(client)

    response = client.post(
        "/api/v1/monitoring/planting-records",
        headers=headers,
        json={
            "crop_id": 1,
            "field_name": "Plot A",
            "planting_date": "2026-07-16",
            "status": "unknown",
        },
    )

    assert response.status_code == 422


def test_csv_import_rejects_non_csv_extension(client: TestClient) -> None:
    headers = admin_header(client)
    content = b"commodity_name,location,price_type,price,unit,recorded_date\nCili,Malaysia,retail,10,kg,2026-07-16\n"

    response = client.post(
        "/api/v1/market-prices/import-csv",
        headers=headers,
        files={"file": ("prices.txt", BytesIO(content), "text/plain")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only CSV files are supported"


def test_csv_import_skips_invalid_enum_rows(client: TestClient) -> None:
    headers = admin_header(client)
    content = b"commodity_name,location,price_type,price,unit,recorded_date,trend\nCili,Malaysia,bad,10,kg,2026-07-16,stable\nTomato,Malaysia,retail,5,kg,2026-07-16,up\n"

    response = client.post(
        "/api/v1/market-prices/import-csv",
        headers=headers,
        files={"file": ("prices.csv", BytesIO(content), "text/csv")},
    )

    assert response.status_code == 200
    assert response.json() == {"imported": 1, "skipped": 1}

def test_market_price_filter_rejects_invalid_price_type(client: TestClient) -> None:
    headers = admin_header(client)

    response = client.get("/api/v1/market-prices?price_type=invalid", headers=headers)

    assert response.status_code == 422
