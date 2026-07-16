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
