from fastapi.testclient import TestClient


def register_user(client: TestClient, email: str = "farmer@example.com", password: str = "password123") -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Test Farmer", "email": email, "password": password},
    )
    assert response.status_code == 201
    return response.json()


def test_register_success_returns_token_without_password_hash(client: TestClient) -> None:
    data = register_user(client)

    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["user"]["email"] == "farmer@example.com"
    assert data["user"]["role"] == "admin"
    assert "password_hash" not in data["user"]
    assert "password" not in data["user"]


def test_register_duplicate_email_returns_conflict(client: TestClient) -> None:
    register_user(client)

    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Other Farmer", "email": "FARMER@example.com", "password": "password123"},
    )

    assert response.status_code == 409


def test_login_success(client: TestClient) -> None:
    register_user(client)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "farmer@example.com", "password": "password123"},
    )

    assert response.status_code == 200
    assert response.json()["access_token"]


def test_login_wrong_password_returns_unauthorized(client: TestClient) -> None:
    register_user(client)

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "farmer@example.com", "password": "wrong-password"},
    )

    assert response.status_code == 401


def test_me_requires_token(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_me_rejects_invalid_token(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not-a-token"})

    assert response.status_code == 401


def test_me_returns_current_user(client: TestClient) -> None:
    registered = register_user(client)

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {registered['access_token']}"},
    )

    assert response.status_code == 200
    assert response.json()["email"] == "farmer@example.com"
