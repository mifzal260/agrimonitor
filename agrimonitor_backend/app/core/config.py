from typing import Annotated

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
    )
    @classmethod
    def require_positive_integer(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("must be greater than 0")
        return value

    @model_validator(mode="after")
    def validate_login_lockout_policy(self) -> "Settings":
        if self.login_lockout_max_seconds < self.login_lockout_base_seconds:
            raise ValueError("LOGIN_LOCKOUT_MAX_SECONDS must be greater than or equal to LOGIN_LOCKOUT_BASE_SECONDS")

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
