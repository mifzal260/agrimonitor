from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import DUMMY_PASSWORD_HASH, create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import TokenResponse, UserCreate, UserLogin
from app.services.login_protection import LoginAttemptContext, login_rate_limiter


def register_user(db: Session, payload: UserCreate) -> TokenResponse:
    existing_user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing_user is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user_count = db.scalar(select(User.id).limit(1))
    role = "admin" if user_count is None else "user"
    user = User(
        name=payload.name.strip(),
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=str(user.id), role=user.role)
    return TokenResponse(access_token=token, user=user)


def authenticate_user(db: Session, payload: UserLogin, context: LoginAttemptContext) -> TokenResponse:
    normalized_email = payload.email.lower()
    user = db.scalar(select(User).where(User.email == normalized_email))
    password_hash = user.password_hash if user is not None else DUMMY_PASSWORD_HASH
    password_valid = verify_password(payload.password, password_hash)

    if user is None or not password_valid:
        reason = "unknown_user" if user is None else "invalid_password"
        login_rate_limiter.record_failure(context, reason=reason)

    assert user is not None
    login_rate_limiter.record_success(context)
    token = create_access_token(subject=str(user.id), role=user.role)
    return TokenResponse(access_token=token, user=user)
