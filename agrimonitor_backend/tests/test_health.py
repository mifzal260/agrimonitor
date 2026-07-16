from collections.abc import Generator

from fastapi.testclient import TestClient

from app.db.database import get_db


class BrokenDatabaseSession:
    def execute(self, statement: object) -> None:
        raise RuntimeError("database unavailable")

    def rollback(self) -> None:
        pass

    def close(self) -> None:
        pass


def test_root_health(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_api_health(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_root_readiness_success(client: TestClient) -> None:
    response = client.get("/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_api_readiness_success(client: TestClient) -> None:
    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_api_readiness_database_failure_returns_503(client: TestClient) -> None:
    def broken_db() -> Generator[BrokenDatabaseSession, None, None]:
        yield BrokenDatabaseSession()

    client.app.dependency_overrides[get_db] = broken_db
    try:
        response = client.get("/api/v1/health/ready")
    finally:
        client.app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}
