import logging
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, settings
from app.core.security import verify_password
from app.db.database import Base
from app.models.user import User
from app.schemas.auth import UserCreate
from app.services.auth_service import UserAlreadyExistsError, provision_admin, register_user
from app.services.login_protection import (
    InMemoryLoginProtectionStore,
    LoginAttemptContext,
    RegistrationProtectionPolicy,
    hash_identifier,
    LoginProtectionService,
)


def registration_payload(email: str = "farmer@example.com", password: str = "password123") -> dict[str, object]:
    return {"name": "Test Farmer", "email": email, "password": password}


def post_registration(client: TestClient, email: str, password: str = "password123"):
    return client.post("/api/v1/auth/register", json=registration_payload(email, password))


def test_first_and_second_public_registrations_are_users(client: TestClient) -> None:
    first = post_registration(client, "first@example.com")
    second = post_registration(client, "second@example.com")

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["user"]["role"] == "user"
    assert second.json()["user"]["role"] == "user"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("role", "admin"),
        ("is_admin", True),
        ("is_superuser", True),
        ("permissions", ["admin"]),
    ],
)
def test_public_registration_rejects_privileged_fields_and_logs_attempt(
    client: TestClient,
    caplog: pytest.LogCaptureFixture,
    field: str,
    value: object,
) -> None:
    payload = registration_payload(f"{field}@example.com")
    payload[field] = value

    with caplog.at_level(logging.INFO, logger="agrimonitor.security"):
        response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422
    assert any(record.__dict__.get("event") == "registration_privileged_field_attempt" for record in caplog.records)
    assert not any(record.__dict__.get("event") == "admin_provisioning_success" for record in caplog.records)


def test_public_registration_rejects_unknown_extra_field(client: TestClient, db_session: Session) -> None:
    payload = registration_payload("extra@example.com")
    payload["favorite_crop"] = "rice"

    response = client.post("/api/v1/auth/register", json=payload)

    assert response.status_code == 422
    assert db_session.scalar(select(User).where(User.email == "extra@example.com")) is None


def test_duplicate_registration_is_generic_and_audited(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    assert post_registration(client, "duplicate@example.com").status_code == 201

    with caplog.at_level(logging.INFO, logger="agrimonitor.security"):
        duplicate = post_registration(client, "DUPLICATE@example.com")

    assert duplicate.status_code == 409
    assert duplicate.json() == {"detail": "Pendaftaran tidak dapat diproses."}
    assert any(
        record.__dict__.get("event") == "registration_duplicate"
        and record.__dict__.get("failure_reason") == "duplicate_email"
        for record in caplog.records
    )


def test_registration_hashes_password_and_logs_no_secret(client: TestClient, db_session: Session, caplog: pytest.LogCaptureFixture) -> None:
    password = "registration-secret-password"
    with caplog.at_level(logging.INFO, logger="agrimonitor.security"):
        response = post_registration(client, "hashed@example.com", password)

    user = db_session.scalar(select(User).where(User.email == "hashed@example.com"))
    assert response.status_code == 201
    assert user is not None
    assert user.role == "user"
    assert user.password_hash != password
    assert verify_password(password, user.password_hash)
    security_records = [record.__dict__ for record in caplog.records if record.name == "agrimonitor.security"]
    security_log = repr(security_records)
    assert password not in security_log
    assert "hashed@example.com" not in security_log
    assert any(record.__dict__.get("event") == "registration_success" for record in caplog.records)


def test_registration_ip_rate_limit_returns_retry_after(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "registration_max_attempts_per_ip", 2)
    monkeypatch.setattr(settings, "registration_max_attempts_per_email", 100)

    assert post_registration(client, "one@example.com").status_code == 201
    assert post_registration(client, "two@example.com").status_code == 201
    limited = post_registration(client, "three@example.com")

    assert limited.status_code == 429
    assert limited.json() == {"detail": "Terlalu banyak percubaan pendaftaran. Sila cuba sebentar lagi."}
    assert int(limited.headers["Retry-After"]) > 0


def test_registration_email_rate_limit_normalizes_identity(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "registration_max_attempts_per_ip", 100)
    monkeypatch.setattr(settings, "registration_max_attempts_per_email", 2)

    assert post_registration(client, "same@example.com").status_code == 201
    assert post_registration(client, "SAME@example.com").status_code == 409
    limited = post_registration(client, "same@example.com")

    assert limited.status_code == 429
    assert int(limited.headers["Retry-After"]) > 0


def test_registration_rate_limit_can_be_disabled(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "registration_rate_limit_enabled", False)
    monkeypatch.setattr(settings, "registration_max_attempts_per_ip", 1)

    assert post_registration(client, "one@example.com").status_code == 201
    assert post_registration(client, "two@example.com").status_code == 201


def test_logging_failure_does_not_break_registration(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services import login_protection

    monkeypatch.setattr(login_protection.security_logger, "info", lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("log down")))
    response = post_registration(client, "logging@example.com")
    assert response.status_code == 201


def test_operator_service_creates_admin_and_audits(db_session: Session, caplog: pytest.LogCaptureFixture) -> None:
    payload = UserCreate(name="Operator Admin", email="admin@example.com", password="password123")

    with caplog.at_level(logging.INFO, logger="agrimonitor.security"):
        admin = provision_admin(db_session, payload, operator_identifier="pytest-operator")

    assert admin.role == "admin"
    assert verify_password("password123", admin.password_hash)
    assert any(record.__dict__.get("event") == "admin_provisioning_success" for record in caplog.records)
    assert all(record.__dict__.get("operator_identifier") != "pytest-operator" for record in caplog.records)


def test_duplicate_admin_provisioning_fails_clearly_and_is_audited(
    db_session: Session,
    caplog: pytest.LogCaptureFixture,
) -> None:
    payload = UserCreate(name="Operator Admin", email="admin@example.com", password="password123")
    provision_admin(db_session, payload, operator_identifier="pytest-operator")

    with caplog.at_level(logging.INFO, logger="agrimonitor.security"), pytest.raises(UserAlreadyExistsError):
        provision_admin(db_session, payload, operator_identifier="pytest-operator")

    assert any(
        record.__dict__.get("event") == "admin_provisioning_failed"
        and record.__dict__.get("failure_reason") == "duplicate_email"
        for record in caplog.records
    )


def test_public_user_is_forbidden_but_provisioned_admin_is_allowed(
    client: TestClient,
    db_session: Session,
) -> None:
    public = post_registration(client, "user@example.com")
    assert public.status_code == 201
    public_check = client.get(
        "/api/v1/auth/admin-check",
        headers={"Authorization": f"Bearer {public.json()['access_token']}"},
    )
    assert public_check.status_code == 403

    provision_admin(
        db_session,
        UserCreate(name="Admin", email="admin@example.com", password="password123"),
        operator_identifier="pytest-operator",
    )
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "password123"},
    )
    assert login.status_code == 200
    admin_check = client.get(
        "/api/v1/auth/admin-check",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert admin_check.status_code == 200
    assert admin_check.json()["role"] == "admin"


def test_no_public_admin_provisioning_endpoint(client: TestClient) -> None:
    assert client.post("/api/v1/auth/create-admin", json=registration_payload()).status_code == 404


def test_concurrent_public_registrations_never_create_admin(tmp_path) -> None:
    engine = create_engine(f"sqlite+pysqlite:///{tmp_path / 'concurrent.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    local_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    config = Settings(jwt_secret_key="concurrency-test-secret", registration_rate_limit_enabled=False, _env_file=None)
    service = LoginProtectionService(InMemoryLoginProtectionStore(), config)

    def create(index: int) -> str:
        db = local_session()
        context = LoginAttemptContext(
            username=f"concurrent-{index}@example.com",
            source_ip="198.51.100.10",
            user_agent="pytest",
            request_id=f"concurrent-{index}",
        )
        try:
            result = register_user(
                db,
                UserCreate(name=f"User {index}", email=f"concurrent-{index}@example.com", password="password123"),
                context,
                service,
            )
            return result.user.role
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        roles = list(executor.map(create, range(2)))

    assert roles == ["user", "user"]
    with local_session() as db:
        assert set(db.scalars(select(User.role)).all()) == {"user"}
    engine.dispose()


def test_concurrent_duplicate_registration_has_one_success_and_one_controlled_duplicate(tmp_path) -> None:
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'duplicate-concurrent.db'}",
        connect_args={"check_same_thread": False, "timeout": 10},
    )
    Base.metadata.create_all(bind=engine)
    local_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    config = Settings(jwt_secret_key="concurrency-test-secret", registration_rate_limit_enabled=False, _env_file=None)
    service = LoginProtectionService(InMemoryLoginProtectionStore(), config)
    barrier = Barrier(2)

    def create(index: int) -> str:
        db = local_session()
        context = LoginAttemptContext(
            username="same@example.com",
            source_ip=f"198.51.100.{index + 10}",
            user_agent="pytest",
            request_id=f"duplicate-{index}",
        )
        barrier.wait()
        try:
            register_user(
                db,
                UserCreate(name=f"User {index}", email="same@example.com", password="password123"),
                context,
                service,
            )
            return "success"
        except HTTPException as exc:
            assert exc.status_code == 409
            assert exc.detail == "Pendaftaran tidak dapat diproses."
            assert db.scalar(select(User).where(User.email == "same@example.com")) is not None
            return "duplicate"
        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(create, range(2)))

    assert sorted(results) == ["duplicate", "success"]
    with local_session() as db:
        assert len(db.scalars(select(User).where(User.email == "same@example.com")).all()) == 1
    engine.dispose()


def test_expired_memory_registration_state_is_pruned() -> None:
    now = [1000.0]
    store = InMemoryLoginProtectionStore(clock=lambda: now[0])
    policy = RegistrationProtectionPolicy(
        email_threshold=5,
        email_window_seconds=10,
        ip_threshold=10,
        ip_window_seconds=10,
    )
    old_email = hash_identifier("old@example.com")
    old_ip = hash_identifier("198.51.100.10")

    assert store.check_and_record_registration(old_email, old_ip, "one", policy).allowed
    now[0] += 11
    assert store.check_and_record_registration(
        hash_identifier("new@example.com"),
        hash_identifier("198.51.100.11"),
        "two",
        policy,
    ).allowed

    assert old_email not in store.registration_email_attempts
    assert old_ip not in store.registration_ip_attempts


def test_invalid_privileged_registration_is_also_rate_limited(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "registration_max_attempts_per_ip", 1)
    monkeypatch.setattr(settings, "registration_max_attempts_per_email", 100)
    payload = registration_payload("privileged@example.com")
    payload["role"] = "admin"

    rejected = client.post("/api/v1/auth/register", json=payload)
    limited = client.post("/api/v1/auth/register", json=payload)

    assert rejected.status_code == 422
    assert limited.status_code == 429
    assert int(limited.headers["Retry-After"]) > 0
