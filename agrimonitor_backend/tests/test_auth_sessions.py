from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier

from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.security import decode_access_token, hash_refresh_token
from app.db.database import Base, get_db
from app.main import create_app
from app.models.auth_session import AuthRefreshToken, AuthSession
from app.services.session_service import GENERIC_REFRESH_ERROR, cleanup_expired_sessions


def register(client: TestClient, password: str = "password123") -> dict:
    response = client.post("/api/v1/auth/register", json={"name": "Session Farmer", "email": "session@example.com", "password": password})
    assert response.status_code == 201
    return response.json()


def login(client: TestClient, password: str = "password123") -> dict:
    response = client.post("/api/v1/auth/login", json={"email": "session@example.com", "password": password})
    assert response.status_code == 200
    return response.json()


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def refresh(client: TestClient, token: str):
    return client.post("/api/v1/auth/refresh", json={"refresh_token": token})


def test_tokens_are_short_lived_session_bound_and_refresh_is_hashed(client: TestClient, db_session: Session) -> None:
    tokens = register(client)
    payload = decode_access_token(tokens["access_token"])
    issued = datetime.fromtimestamp(int(payload["iat"]), UTC)
    expires = datetime.fromtimestamp(int(payload["exp"]), UTC)
    stored = db_session.scalar(select(AuthRefreshToken))

    assert expires - issued == timedelta(minutes=15)
    assert payload["session_id"] and payload["jti"] and "role" not in payload
    assert len(tokens["refresh_token"]) >= 43
    assert tokens["expires_in"] == 900
    assert stored is not None
    assert stored.token_hash == hash_refresh_token(tokens["refresh_token"])
    assert stored.token_hash != tokens["refresh_token"]


def test_rotation_and_replay_revoke_entire_family(client: TestClient, db_session: Session) -> None:
    initial = register(client)
    rotated_response = refresh(client, initial["refresh_token"])
    assert rotated_response.status_code == 200
    rotated = rotated_response.json()
    assert rotated["refresh_token"] != initial["refresh_token"]

    replay = refresh(client, initial["refresh_token"])
    replacement = refresh(client, rotated["refresh_token"])
    assert replay.status_code == replacement.status_code == 401
    assert replay.json() == replacement.json() == {"detail": GENERIC_REFRESH_ERROR}

    auth_session = db_session.scalar(select(AuthSession))
    assert auth_session is not None
    db_session.refresh(auth_session)
    assert auth_session.revoked_at and auth_session.reuse_detected_at
    assert auth_session.revoke_reason == "refresh_token_reuse"


def test_refresh_failures_are_generic(client: TestClient, db_session: Session) -> None:
    tokens = register(client)
    malformed = refresh(client, "short")
    unknown = refresh(client, "x" * 64)
    stored = db_session.scalar(select(AuthRefreshToken))
    assert stored is not None
    stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.commit()
    expired = refresh(client, tokens["refresh_token"])

    for response in (malformed, unknown, expired):
        assert response.status_code == 401
        assert response.json() == {"detail": GENERIC_REFRESH_ERROR}


def test_logout_is_idempotent_and_logout_all_revokes_every_device(client: TestClient) -> None:
    first = register(client)
    second = login(client)
    assert client.post("/api/v1/auth/logout", headers=bearer(first["access_token"])).status_code == 204
    assert client.post("/api/v1/auth/logout", headers=bearer(first["access_token"])).status_code == 204
    assert refresh(client, first["refresh_token"]).status_code == 401

    assert client.post("/api/v1/auth/logout-all", headers=bearer(second["access_token"])).status_code == 204
    assert refresh(client, second["refresh_token"]).status_code == 401


def test_password_change_revokes_sessions_and_wrong_password_does_not(client: TestClient) -> None:
    first = register(client)
    second = login(client)
    wrong = client.post("/api/v1/auth/change-password", headers=bearer(first["access_token"]), json={"current_password": "wrong", "new_password": "new-password-456"})
    assert wrong.status_code == 400
    assert refresh(client, first["refresh_token"]).status_code == 200

    changed = client.post("/api/v1/auth/change-password", headers=bearer(second["access_token"]), json={"current_password": "password123", "new_password": "new-password-456"})
    assert changed.status_code == 204
    assert refresh(client, second["refresh_token"]).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "session@example.com", "password": "password123"}).status_code == 401
    assert login(client, "new-password-456")["refresh_token"]


def test_max_sessions_revokes_oldest(client: TestClient, monkeypatch) -> None:
    monkeypatch.setattr(settings, "max_active_sessions_per_user", 2)
    first, second, third = register(client), login(client), login(client)
    assert refresh(client, first["refresh_token"]).status_code == 401
    assert refresh(client, second["refresh_token"]).status_code == 200
    assert refresh(client, third["refresh_token"]).status_code == 200


def test_legacy_access_token_rollout_flag(client: TestClient, monkeypatch) -> None:
    registered = register(client)
    legacy = jwt.encode({"sub": str(registered["user"]["id"]), "exp": datetime.now(UTC) + timedelta(minutes=5)}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    monkeypatch.setattr(settings, "allow_legacy_access_tokens", True)
    assert client.get("/api/v1/auth/me", headers=bearer(legacy)).status_code == 200
    monkeypatch.setattr(settings, "allow_legacy_access_tokens", False)
    assert client.get("/api/v1/auth/me", headers=bearer(legacy)).status_code == 401


def test_cleanup_is_batched_and_idempotent(client: TestClient, db_session: Session) -> None:
    register(client)
    login(client)
    sessions = list(db_session.scalars(select(AuthSession).order_by(AuthSession.created_at)).all())
    for index, auth_session in enumerate(sessions):
        auth_session.expires_at = datetime.now(UTC) - timedelta(hours=index + 1)
    db_session.commit()

    assert cleanup_expired_sessions(db_session, batch_size=1) == 1
    assert cleanup_expired_sessions(db_session, batch_size=1) == 1
    assert cleanup_expired_sessions(db_session, batch_size=1) == 0
    assert db_session.scalar(select(AuthSession)) is None

def test_concurrent_refresh_allows_only_one_success(tmp_path) -> None:
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'refresh-race.db'}",
        connect_args={"check_same_thread": False, "timeout": 10},
    )
    Base.metadata.create_all(bind=engine)
    local_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    app = create_app()

    def override_db():
        db = local_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as race_client:
        initial = register(race_client)
        barrier = Barrier(2)

        def rotate_once() -> int:
            barrier.wait()
            return refresh(race_client, initial["refresh_token"]).status_code

        with ThreadPoolExecutor(max_workers=2) as executor:
            statuses = sorted(executor.map(lambda _: rotate_once(), range(2)))

    app.dependency_overrides.clear()
    engine.dispose()
    assert statuses == [200, 401]


def test_session_store_failure_does_not_leave_duplicate_active_session(
    client: TestClient,
    db_session: Session,
    monkeypatch,
) -> None:
    from app.services import session_service

    initial = register(client)
    monkeypatch.setattr(session_service, "create_refresh_token", lambda: initial["refresh_token"])
    failed = client.post("/api/v1/auth/login", json={"email": "session@example.com", "password": "password123"})

    assert failed.status_code == 503
    sessions = list(db_session.scalars(select(AuthSession)).all())
    assert len(sessions) == 1
    assert sessions[0].revoked_at is None
    monkeypatch.undo()
    assert refresh(client, initial["refresh_token"]).status_code == 200


def test_logout_all_does_not_revoke_another_user(client: TestClient) -> None:
    first = register(client)
    other_response = client.post(
        "/api/v1/auth/register",
        json={"name": "Other Farmer", "email": "other@example.com", "password": "password123"},
    )
    assert other_response.status_code == 201
    other = other_response.json()

    assert client.post("/api/v1/auth/logout-all", headers=bearer(first["access_token"])).status_code == 204
    assert refresh(client, first["refresh_token"]).status_code == 401
    assert refresh(client, other["refresh_token"]).status_code == 200
