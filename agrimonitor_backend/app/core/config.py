import re
from typing import Annotated, Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AgriMonitor API"
    app_env: str = "local"
    api_prefix: str = "/api/v1"
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:5173"]
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/agrimonitor"
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    prepare_database_on_startup: bool = True
    logging_level: str = "INFO"
    csv_max_upload_bytes: int = 1_048_576
    csv_max_rows: int = 5_000
    login_rate_limit_enabled: bool = True
    login_max_attempts_per_account: int = 5
    login_account_window_seconds: int = 300
    login_max_attempts_per_ip: int = 15
    login_ip_window_seconds: int = 900
    login_lockout_base_seconds: int = 60
    login_lockout_max_seconds: int = 1_800
    login_protection_store: Literal["memory", "redis"] = "memory"
    login_protection_fail_mode: Literal["closed"] = "closed"
    redis_url: str | None = None
    redis_key_prefix: str = "agrimonitor:login-protection"
    redis_socket_timeout_seconds: float = 2
    redis_connect_timeout_seconds: float = 2
    redis_health_check_interval_seconds: int = 30
    redis_max_connections: int = 20
    trusted_proxy_ips: Annotated[list[str], NoDecode] = []

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("trusted_proxy_ips", mode="before")
    @classmethod
    def parse_trusted_proxy_ips(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [ip.strip() for ip in value.split(",") if ip.strip()]
        return value

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @field_validator("app_env", "logging_level", mode="before")
    @classmethod
    def normalize_lowercase_fields(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator(
        "access_token_expire_minutes",
        "csv_max_upload_bytes",
        "csv_max_rows",
        "login_max_attempts_per_account",
        "login_account_window_seconds",
        "login_max_attempts_per_ip",
        "login_ip_window_seconds",
        "login_lockout_base_seconds",
        "login_lockout_max_seconds",
        "redis_socket_timeout_seconds",
        "redis_connect_timeout_seconds",
        "redis_health_check_interval_seconds",
        "redis_max_connections",
    )
    @classmethod
    def require_positive_number(cls, value: int | float) -> int | float:
        if value <= 0:
            raise ValueError("must be greater than 0")
        return value

    @field_validator("redis_key_prefix")
    @classmethod
    def require_redis_key_prefix(cls, value: str) -> str:
        prefix = value.strip().rstrip(":")
        if not prefix:
            raise ValueError("REDIS_KEY_PREFIX cannot be empty")
        if re.fullmatch(r"[A-Za-z0-9:_-]+", prefix) is None:
            raise ValueError("REDIS_KEY_PREFIX contains invalid characters")
        return prefix

    @model_validator(mode="after")
    def validate_login_lockout_policy(self) -> "Settings":
        if self.login_lockout_max_seconds < self.login_lockout_base_seconds:
            raise ValueError("LOGIN_LOCKOUT_MAX_SECONDS must be greater than or equal to LOGIN_LOCKOUT_BASE_SECONDS")
        return self

    @model_validator(mode="after")
    def validate_login_protection_store(self) -> "Settings":
        if self.login_protection_store == "redis" and not (self.redis_url or "").strip():
            raise ValueError("REDIS_URL is required when LOGIN_PROTECTION_STORE=redis")
        return self

    @model_validator(mode="after")
    def validate_production_safety(self) -> "Settings":
        if self.app_env not in {"production", "prod"}:
            return self
        if "*" in self.cors_origins:
            raise ValueError("CORS_ORIGINS cannot contain '*' in production")
        if "localhost" in self.database_url or "127.0.0.1" in self.database_url:
            raise ValueError("DATABASE_URL cannot use localhost in production")
        if self.jwt_secret_key in {"change-this-secret-in-env", "test-secret-key"} or len(self.jwt_secret_key) < 32:
            raise ValueError("JWT_SECRET_KEY is too weak for production")
        if self.prepare_database_on_startup:
            raise ValueError("PREPARE_DATABASE_ON_STARTUP must be false in production")
        return self


settings = Settings()
