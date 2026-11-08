import re
from typing import Annotated, Literal
from urllib.parse import urlsplit

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
    access_token_expire_minutes: int = 15
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
    registration_rate_limit_enabled: bool = True
    registration_max_attempts_per_email: int = 5
    registration_email_window_seconds: int = 1_800
    registration_max_attempts_per_ip: int = 10
    registration_ip_window_seconds: int = 3_600
    refresh_token_expire_days: int = 14
    refresh_token_rotation_enabled: bool = True
    refresh_token_reuse_detection_enabled: bool = True
    max_active_sessions_per_user: int = 10
    session_cleanup_batch_size: int = 500
    allow_legacy_access_tokens: bool = True
    login_protection_store: Literal["memory", "redis"] = "memory"
    login_protection_fail_mode: Literal["closed"] = "closed"
    redis_url: str | None = None
    redis_key_prefix: str = "agrimonitor:login-protection"
    redis_socket_timeout_seconds: float = 2
    redis_connect_timeout_seconds: float = 2
    redis_health_check_interval_seconds: int = 30
    redis_max_connections: int = 20
    trusted_proxy_ips: Annotated[list[str], NoDecode] = []
    iot_data_mode: str = "simulation"
    iot_online_after_seconds: int = 600
    iot_offline_after_seconds: int = 3600
    iot_temperature_warning_celsius: int = 35
    iot_soil_moisture_warning_percent: int = 30
    iot_battery_warning_percent: int = 20
    ollama_base_url: str = "https://ollama.com"
    ollama_api_key: str | None = None
    ollama_model: str = "beam"
    ollama_temperature: float = 0.4
    ollama_num_ctx: int = 4096
    ollama_num_predict: int = 400

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

    @field_validator("app_env", "logging_level", "iot_data_mode", mode="before")
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
        "registration_max_attempts_per_email",
        "registration_email_window_seconds",
        "registration_max_attempts_per_ip",
        "registration_ip_window_seconds",
        "redis_socket_timeout_seconds",
        "redis_connect_timeout_seconds",
        "redis_health_check_interval_seconds",
        "redis_max_connections",
        "refresh_token_expire_days",
        "max_active_sessions_per_user",
        "session_cleanup_batch_size",
        "iot_online_after_seconds",
        "iot_offline_after_seconds",
        "iot_temperature_warning_celsius",
        "iot_soil_moisture_warning_percent",
        "iot_battery_warning_percent",
        "ollama_num_ctx",
        "ollama_num_predict",
    )
    @classmethod
    def require_positive_number(cls, value: int | float) -> int | float:
        if value <= 0:
            raise ValueError("must be greater than 0")
        return value

    @field_validator("ollama_base_url")
    @classmethod
    def normalize_ollama_base_url(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        parsed = urlsplit(normalized)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("OLLAMA_BASE_URL must be a valid HTTP(S) base URL without credentials")
        return normalized

    @field_validator("ollama_api_key", mode="before")
    @classmethod
    def normalize_ollama_api_key(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            return value.strip() or None
        return value

    @field_validator("ollama_model")
    @classmethod
    def require_ollama_model(cls, value: str) -> str:
        model = value.strip()
        if not model:
            raise ValueError("OLLAMA_MODEL cannot be empty")
        return model

    @field_validator("ollama_temperature")
    @classmethod
    def validate_ollama_temperature(cls, value: float) -> float:
        if not 0 <= value <= 1:
            raise ValueError("OLLAMA_TEMPERATURE must be between 0 and 1")
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
    def validate_session_policy(self) -> "Settings":
        if self.refresh_token_expire_days * 1_440 <= self.access_token_expire_minutes:
            raise ValueError("REFRESH_TOKEN_EXPIRE_DAYS must outlive the access token")
        if self.app_env in {"production", "prod"} and self.access_token_expire_minutes > 15:
            raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES cannot exceed 15 in production")
        protections_enabled = self.refresh_token_rotation_enabled and self.refresh_token_reuse_detection_enabled
        if not protections_enabled:
            raise ValueError("Refresh token rotation and reuse detection cannot be disabled")
        return self

    @model_validator(mode="after")
    def validate_iot_settings(self) -> "Settings":
        if self.iot_data_mode not in {"simulation", "iot"}:
            raise ValueError("IOT_DATA_MODE must be simulation or iot")
        if self.iot_offline_after_seconds <= self.iot_online_after_seconds:
            raise ValueError("IOT_OFFLINE_AFTER_SECONDS must be greater than IOT_ONLINE_AFTER_SECONDS")
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
