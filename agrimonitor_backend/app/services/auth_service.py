import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import DUMMY_PASSWORD_HASH, create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import TokenResponse, UserCreate, UserLogin
from app.services.login_protection import (
    LoginAttemptContext,
    LoginProtectionService,
    hash_identifier,
    normalize_username,
)

GENERIC_REGISTRATION_ERROR = "Pendaftaran tidak dapat diproses."
security_logger = logging.getLogger("agrimonitor.security")


class UserAlreadyExistsError(ValueError):
    pass


def _user_fields(payload: UserCreate) -> dict[str, str]:
    return {
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
    }


def _persist_user(db: Session, user: User) -> User:
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise UserAlreadyExistsError("User email already exists") from exc
    db.refresh(user)
    return user


def register_user(
    db: Session,
    payload: UserCreate,
    context: LoginAttemptContext,
    login_protection: LoginProtectionService,
) -> TokenResponse:
    try:
        user = _persist_user(db, User(**_user_fields(payload), role="user"))
    except UserAlreadyExistsError:
        login_protection.record_registration_duplicate(context)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=GENERIC_REGISTRATION_ERROR)
    except Exception:
        db.rollback()
        login_protection.record_registration_failure(context, reason="creation_failed")
        raise

    login_protection.record_registration_success(context)
    token = create_access_token(subject=str(user.id), role=user.role)
    return TokenResponse(access_token=token, user=user)


def provision_admin(db: Session, payload: UserCreate, operator_identifier: str) -> User:
    try:
        user = _persist_user(db, User(**_user_fields(payload), role="admin"))
    except UserAlreadyExistsError:
        _log_admin_provisioning("admin_provisioning_failed", payload.email, operator_identifier, "duplicate_email")
        raise
    except Exception:
        db.rollback()
        _log_admin_provisioning("admin_provisioning_failed", payload.email, operator_identifier, "creation_failed")
        raise

    _log_admin_provisioning("admin_provisioning_success", payload.email, operator_identifier)
    return user


def _log_admin_provisioning(
    event: str,
    email: str,
    operator_identifier: str,
    reason: str | None = None,
) -> None:
    try:
        security_logger.info(
            "security_event",
            extra={
                "event": event,
                "username_hash": hash_identifier(normalize_username(email)),
                "operator_identifier": hash_identifier(operator_identifier),
                "failure_reason": reason,
            },
        )
    except Exception:
        return


def authenticate_user(
    db: Session,
    payload: UserLogin,
    context: LoginAttemptContext,
    login_protection: LoginProtectionService,
) -> TokenResponse:
    normalized_email = payload.email.lower()
    user = db.scalar(select(User).where(User.email == normalized_email))
    password_hash = user.password_hash if user is not None else DUMMY_PASSWORD_HASH
    password_valid = verify_password(payload.password, password_hash)

    if user is None or not password_valid:
        reason = "unknown_user" if user is None else "invalid_password"
        login_protection.record_failure(context, reason=reason)

    assert user is not None
    login_protection.record_success(context)
    token = create_access_token(subject=str(user.id), role=user.role)
    return TokenResponse(access_token=token, user=user)
