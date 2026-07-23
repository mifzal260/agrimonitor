from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

BCRYPT_ROUNDS = 12
MAX_BCRYPT_PASSWORD_BYTES = 72
DUMMY_PASSWORD_HASH = "$2b$12$7EqJtq98hPqEX7fNZaFWoOhi9L89XxI6zJFwFAt8xVbXzQl42H9Xi"


class PasswordTooLongError(ValueError):
    pass


def validate_password_length(password: str) -> str:
    if len(password.encode("utf-8")) > MAX_BCRYPT_PASSWORD_BYTES:
        raise PasswordTooLongError(
            f"Password must not exceed {MAX_BCRYPT_PASSWORD_BYTES} UTF-8 bytes"
        )
    return password


def hash_password(password: str) -> str:
    password_bytes = validate_password_length(password).encode("utf-8")
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS, prefix=b"2b")
    return bcrypt.hashpw(password_bytes, salt).decode("ascii")


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        password_bytes = plain_password.encode("utf-8")
        password_hash_bytes = password_hash.encode("ascii")
    except UnicodeEncodeError:
        return False

    try:
        if len(password_bytes) > MAX_BCRYPT_PASSWORD_BYTES:
            # Perform one bcrypt operation without allowing bcrypt's legacy
            # 72-byte truncation semantics to authenticate an oversized input.
            bcrypt.checkpw(b"\x00" * MAX_BCRYPT_PASSWORD_BYTES, password_hash_bytes)
            return False
        return bcrypt.checkpw(password_bytes, password_hash_bytes)
    except ValueError:
        return False


def create_access_token(subject: str, role: str) -> str:
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": subject, "role": role, "exp": expires_at}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, str]:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
