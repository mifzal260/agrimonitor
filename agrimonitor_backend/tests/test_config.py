import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_production_rejects_wildcard_cors() -> None:
    with pytest.raises(ValidationError):
        Settings(
            app_env="production",
            cors_origins=["*"],
            database_url="postgresql+psycopg://user:pass@db.example.com:5432/agrimonitor",
            jwt_secret_key="x" * 40,
            prepare_database_on_startup=False,
            _env_file=None,
        )


def test_production_rejects_weak_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(
            app_env="production",
            cors_origins=["https://app.example.com"],
            database_url="postgresql+psycopg://user:pass@db.example.com:5432/agrimonitor",
            jwt_secret_key="short-secret",
            prepare_database_on_startup=False,
            _env_file=None,
        )


def test_local_settings_normalize_postgresql_driver() -> None:
    settings = Settings(
        app_env="local",
        cors_origins="http://localhost:5173, http://127.0.0.1:5173",
        database_url="postgresql://user:pass@localhost:5432/agrimonitor",
        jwt_secret_key="local-test-secret",
        _env_file=None,
    )

    assert settings.database_url.startswith("postgresql+psycopg://")
    assert settings.cors_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_login_rate_limit_settings_parse_from_environment_values() -> None:
    settings = Settings(
        jwt_secret_key="local-test-secret",
        login_rate_limit_enabled="false",
        login_max_attempts_per_account="7",
        login_account_window_seconds="600",
        login_max_attempts_per_ip="21",
        login_ip_window_seconds="1200",
        login_lockout_base_seconds="90",
        login_lockout_max_seconds="3600",
        trusted_proxy_ips="10.0.0.1, 10.0.0.2",
        _env_file=None,
    )

    assert settings.login_rate_limit_enabled is False
    assert settings.login_max_attempts_per_account == 7
    assert settings.login_account_window_seconds == 600
    assert settings.login_max_attempts_per_ip == 21
    assert settings.login_ip_window_seconds == 1200
    assert settings.login_lockout_base_seconds == 90
    assert settings.login_lockout_max_seconds == 3600
    assert settings.trusted_proxy_ips == ["10.0.0.1", "10.0.0.2"]


def test_login_lockout_max_cannot_be_lower_than_base() -> None:
    with pytest.raises(ValidationError):
        Settings(
            jwt_secret_key="local-test-secret",
            login_lockout_base_seconds=120,
            login_lockout_max_seconds=60,
            _env_file=None,
        )


def test_redis_store_requires_url() -> None:
    with pytest.raises(ValidationError):
        Settings(
            jwt_secret_key="local-test-secret",
            login_protection_store="redis",
            redis_url="",
            _env_file=None,
        )


def test_login_protection_rejects_unknown_store_and_fail_mode() -> None:
    with pytest.raises(ValidationError):
        Settings(jwt_secret_key="local-test-secret", login_protection_store="database", _env_file=None)
    with pytest.raises(ValidationError):
        Settings(jwt_secret_key="local-test-secret", login_protection_fail_mode="open", _env_file=None)


def test_redis_settings_require_positive_timeouts_and_nonempty_prefix() -> None:
    for field in (
        "redis_socket_timeout_seconds",
        "redis_connect_timeout_seconds",
        "redis_health_check_interval_seconds",
        "redis_max_connections",
    ):
        with pytest.raises(ValidationError):
            Settings(jwt_secret_key="local-test-secret", **{field: 0}, _env_file=None)
    with pytest.raises(ValidationError):
        Settings(jwt_secret_key="local-test-secret", redis_key_prefix=" : ", _env_file=None)
    with pytest.raises(ValidationError):
        Settings(jwt_secret_key="local-test-secret", redis_key_prefix="unsafe prefix*", _env_file=None)


def test_memory_mode_does_not_require_redis() -> None:
    settings = Settings(jwt_secret_key="local-test-secret", login_protection_store="memory", redis_url=None, _env_file=None)
    assert settings.login_protection_store == "memory"
    assert settings.login_protection_fail_mode == "closed"


def test_redis_store_is_selected_by_factory(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.login_protection import (
        RedisLoginProtectionStore,
        build_login_protection_service,
    )

    config = Settings(
        jwt_secret_key="local-test-secret",
        login_protection_store="redis",
        redis_url="redis://localhost:6379/0",
        _env_file=None,
    )
    sentinel = object()
    monkeypatch.setattr(RedisLoginProtectionStore, "from_settings", classmethod(lambda cls, value: sentinel))

    service = build_login_protection_service(config)

    assert service.store is sentinel
