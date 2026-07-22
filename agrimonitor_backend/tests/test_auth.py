import pytest
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


class FakeClock:
    def __init__(self) -> None:
        self.now = 1_000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def post_login(client: TestClient, email: str, password: str, headers: dict[str, str] | None = None):
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
        headers=headers or {},
    )


def test_login_unknown_user_uses_same_generic_message(client: TestClient) -> None:
    register_user(client)

    wrong_password = post_login(client, "farmer@example.com", "wrong-password")
    unknown_user = post_login(client, "missing@example.com", "wrong-password")

    assert wrong_password.status_code == 401
    assert unknown_user.status_code == 401
    assert wrong_password.json() == unknown_user.json() == {"detail": "Nama pengguna atau kata laluan tidak sah."}


def test_account_lockout_after_repeated_failures_and_retry_after(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings
    from app.services.login_protection import set_login_rate_limiter_clock

    clock = FakeClock()
    set_login_rate_limiter_clock(clock)
    monkeypatch.setattr(settings, "login_max_attempts_per_account", 5)
    monkeypatch.setattr(settings, "login_lockout_base_seconds", 60)

    register_user(client)

    for _ in range(4):
        response = post_login(client, "farmer@example.com", "wrong-password")
        assert response.status_code == 401

    locked = post_login(client, "farmer@example.com", "wrong-password")
    assert locked.status_code == 429
    assert locked.headers["Retry-After"] == "60"

    still_locked = post_login(client, "farmer@example.com", "password123")
    assert still_locked.status_code == 429

    clock.advance(61)
    allowed = post_login(client, "farmer@example.com", "password123")
    assert allowed.status_code == 200

    reset_failure_count = post_login(client, "farmer@example.com", "wrong-password")
    assert reset_failure_count.status_code == 401


def test_ip_rate_limit_counts_many_usernames(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "login_max_attempts_per_account", 100)
    monkeypatch.setattr(settings, "login_max_attempts_per_ip", 3)

    for attempt in range(3):
        response = post_login(client, f"missing-{attempt}@example.com", "wrong-password")
        assert response.status_code == 401

    limited = post_login(client, "another@example.com", "wrong-password")
    assert limited.status_code == 429
    assert "Retry-After" in limited.headers


def test_account_lockout_cannot_be_evaded_by_changing_ip(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "trusted_proxy_ips", ["testclient"])
    monkeypatch.setattr(settings, "login_max_attempts_per_account", 3)
    monkeypatch.setattr(settings, "login_max_attempts_per_ip", 100)

    register_user(client)

    for index in range(2):
        response = post_login(
            client,
            "farmer@example.com",
            "wrong-password",
            headers={"x-forwarded-for": f"203.0.113.{index}"},
        )
        assert response.status_code == 401

    locked = post_login(
        client,
        "farmer@example.com",
        "wrong-password",
        headers={"x-forwarded-for": "203.0.113.99"},
    )
    assert locked.status_code == 429


def test_untrusted_forwarded_for_header_does_not_change_source_ip(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "trusted_proxy_ips", [])
    monkeypatch.setattr(settings, "login_max_attempts_per_account", 100)
    monkeypatch.setattr(settings, "login_max_attempts_per_ip", 2)

    for index in range(2):
        response = post_login(
            client,
            f"missing-{index}@example.com",
            "wrong-password",
            headers={"x-forwarded-for": f"203.0.113.{index}"},
        )
        assert response.status_code == 401

    limited = post_login(
        client,
        "missing-final@example.com",
        "wrong-password",
        headers={"x-forwarded-for": "203.0.113.200"},
    )
    assert limited.status_code == 429


def test_rate_limit_can_be_disabled_for_controlled_environments(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "login_rate_limit_enabled", False)
    register_user(client)

    for _ in range(6):
        response = post_login(client, "farmer@example.com", "wrong-password")
        assert response.status_code == 401


def test_security_logs_do_not_include_password_or_token(client: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    import logging

    register_user(client)

    with caplog.at_level(logging.INFO, logger="agrimonitor.security"):
        post_login(client, "farmer@example.com", "secret-password-value")
        post_login(client, "farmer@example.com", "password123")

    security_records = [record for record in caplog.records if record.name == "agrimonitor.security"]
    log_text = "\n".join(record.getMessage() for record in security_records)
    assert "secret-password-value" not in log_text
    assert "password123" not in log_text
    assert "Bearer" not in log_text
    assert {record.__dict__.get("event") for record in security_records} >= {"login_failed", "login_success"}
    assert all(record.__dict__.get("username_hash") for record in security_records)


def test_login_limiter_tracks_concurrent_failures_without_losing_attempts(monkeypatch: pytest.MonkeyPatch) -> None:
    from concurrent.futures import ThreadPoolExecutor

    from fastapi import HTTPException

    from app.core.config import settings
    from app.services.login_protection import LoginAttemptContext, login_rate_limiter

    monkeypatch.setattr(settings, "login_max_attempts_per_account", 100)
    context = LoginAttemptContext(
        username="concurrent@example.com",
        source_ip="198.51.100.10",
        user_agent="pytest",
        request_id="race-test",
    )

    def fail_once() -> None:
        try:
            login_rate_limiter.record_failure(context, reason="invalid_password")
        except HTTPException as exc:
            assert exc.status_code == 401

    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(lambda _: fail_once(), range(20)))

    assert login_rate_limiter.store.account_states[context.username_hash].failure_count == 20


def test_account_failure_window_expires_before_lockout(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings
    from app.services.login_protection import set_login_rate_limiter_clock

    clock = FakeClock()
    set_login_rate_limiter_clock(clock)
    monkeypatch.setattr(settings, "login_max_attempts_per_account", 3)
    monkeypatch.setattr(settings, "login_account_window_seconds", 10)
    monkeypatch.setattr(settings, "login_max_attempts_per_ip", 100)

    register_user(client)

    for _ in range(2):
        response = post_login(client, "farmer@example.com", "wrong-password")
        assert response.status_code == 401

    clock.advance(11)
    response = post_login(client, "farmer@example.com", "wrong-password")
    assert response.status_code == 401

    from app.services.login_protection import hash_identifier, login_rate_limiter

    assert login_rate_limiter.store.account_states[hash_identifier("farmer@example.com")].failure_count == 1


def test_account_lockout_normalizes_email_case_and_whitespace(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings

    monkeypatch.setattr(settings, "login_max_attempts_per_account", 2)
    monkeypatch.setattr(settings, "login_max_attempts_per_ip", 100)

    register_user(client)

    response = post_login(client, " FARMER@example.com ", "wrong-password")
    assert response.status_code == 401

    locked = post_login(client, "farmer@example.com", "wrong-password")
    assert locked.status_code == 429


def test_account_lockout_is_capped_by_max_seconds(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings
    from app.services.login_protection import set_login_rate_limiter_clock

    clock = FakeClock()
    set_login_rate_limiter_clock(clock)
    monkeypatch.setattr(settings, "login_max_attempts_per_account", 1)
    monkeypatch.setattr(settings, "login_lockout_base_seconds", 60)
    monkeypatch.setattr(settings, "login_lockout_max_seconds", 90)
    monkeypatch.setattr(settings, "login_max_attempts_per_ip", 100)

    register_user(client)

    first_lock = post_login(client, "farmer@example.com", "wrong-password")
    assert first_lock.status_code == 429
    assert first_lock.headers["Retry-After"] == "60"

    clock.advance(61)
    second_lock = post_login(client, "farmer@example.com", "wrong-password")
    assert second_lock.status_code == 429
    assert second_lock.headers["Retry-After"] == "90"

    clock.advance(91)
    third_lock = post_login(client, "farmer@example.com", "wrong-password")
    assert third_lock.status_code == 429
    assert third_lock.headers["Retry-After"] == "90"


def test_expired_login_limiter_state_is_pruned(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.config import settings
    from app.services.login_protection import hash_identifier, login_rate_limiter, set_login_rate_limiter_clock

    clock = FakeClock()
    set_login_rate_limiter_clock(clock)
    monkeypatch.setattr(settings, "login_account_window_seconds", 10)
    monkeypatch.setattr(settings, "login_ip_window_seconds", 10)
    monkeypatch.setattr(settings, "login_max_attempts_per_account", 100)
    monkeypatch.setattr(settings, "login_max_attempts_per_ip", 100)

    register_user(client)
    response = post_login(client, "farmer@example.com", "wrong-password")
    assert response.status_code == 401
    assert hash_identifier("farmer@example.com") in login_rate_limiter.store.account_states

    clock.advance(11)
    response = post_login(client, "cleanup-trigger@example.com", "wrong-password")
    assert response.status_code == 401

    assert hash_identifier("farmer@example.com") not in login_rate_limiter.store.account_states
