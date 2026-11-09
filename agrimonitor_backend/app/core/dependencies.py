from dataclasses import dataclass
import logging

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.database import get_db
from app.models.user import User
from app.services.session_service import is_session_active

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
AUTHENTICATION_ERROR = "Invalid or expired token"
security_logger = logging.getLogger("agrimonitor.security")


@dataclass(frozen=True)
class AuthenticatedUser:
    user: User
    session_id: str | None


def _authenticate_access_token(
    token: str,
    db: Session,
    *,
    require_active_session: bool,
) -> AuthenticatedUser:
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub", "0"))
        if "session_id" not in payload:
            if not settings.allow_legacy_access_tokens:
                raise ValueError("Legacy access tokens are disabled")
            session_id = None
            security_logger.warning(
                "legacy_access_token_accepted",
                extra={"user_id": user_id},
            )
        else:
            raw_session_id = payload["session_id"]
            if not isinstance(raw_session_id, str) or not raw_session_id.strip():
                raise ValueError("Invalid session claim")
            session_id = raw_session_id
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=AUTHENTICATION_ERROR,
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    if (
        require_active_session
        and session_id is not None
        and not is_session_active(db, user_id, session_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=AUTHENTICATION_ERROR,
            headers={"WWW-Authenticate": "Bearer"},
        )

    return AuthenticatedUser(user=user, session_id=session_id)


def get_authenticated_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
    return _authenticate_access_token(token, db, require_active_session=True)


def get_authenticated_user_for_logout(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> AuthenticatedUser:
    return _authenticate_access_token(token, db, require_active_session=False)


def get_current_user(
    authenticated: AuthenticatedUser = Depends(get_authenticated_user),
) -> User:
    return authenticated.user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    return current_user
