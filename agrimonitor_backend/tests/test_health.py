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


def test_readiness_fails_when_required_redis_is_unavailable(client: TestClient) -> None:
    import fakeredis

    from app.core.config import Settings
    from app.services.login_protection import LoginProtectionService, RedisLoginProtectionStore

    server = fakeredis.FakeServer()
    server.connected = False
    store = RedisLoginProtectionStore(fakeredis.FakeRedis(server=server), "test:login")
    client.app.state.login_protection = LoginProtectionService(
        store=store,
        config=Settings(
            jwt_secret_key="local-test-secret",
            login_protection_store="redis",
            redis_url="redis://localhost:6379/0",
            _env_file=None,
        ),
    )

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 503
    assert response.json() == {"detail": "Login protection unavailable"}


def test_readiness_passes_when_required_redis_is_available(client: TestClient) -> None:
    import fakeredis

    from app.core.config import Settings
    from app.services.login_protection import LoginProtectionService, RedisLoginProtectionStore

    store = RedisLoginProtectionStore(fakeredis.FakeRedis(), "test:login")
    client.app.state.login_protection = LoginProtectionService(
        store=store,
        config=Settings(
            jwt_secret_key="local-test-secret",
            login_protection_store="redis",
            redis_url="redis://localhost:6379/0",
            _env_file=None,
        ),
    )

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready"}


def test_login_protection_service_is_built_once_and_closed_on_shutdown(monkeypatch) -> None:
    import app.main as main_module

    class SpyLoginProtection:
        def __init__(self) -> None:
            self.ready_calls = 0
            self.closed = False

        def ready(self) -> bool:
            self.ready_calls += 1
            return True

        def close(self) -> None:
            self.closed = True

    spy = SpyLoginProtection()
    monkeypatch.setattr(main_module, "build_login_protection_service", lambda config: spy)
    app = main_module.create_app()

    with TestClient(app) as lifecycle_client:
        first_identity = id(lifecycle_client.app.state.login_protection)
        assert lifecycle_client.get("/health").status_code == 200
        assert lifecycle_client.get("/health").status_code == 200
        assert id(lifecycle_client.app.state.login_protection) == first_identity == id(spy)

    assert spy.closed is True