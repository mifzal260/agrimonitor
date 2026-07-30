from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.core.dependencies import (
    AuthenticatedUser,
    get_authenticated_user,
    get_current_user,
    require_admin,
)
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import (
    PasswordChangeRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserRead,
)
from app.services.auth_service import authenticate_user, change_password, register_user
from app.services.login_protection import LoginProtectionService
from app.services.session_service import revoke_all_user_sessions, revoke_session, rotate_refresh_token

router = APIRouter()


def get_login_protection(request: Request) -> LoginProtectionService:
    return request.app.state.login_protection


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(
    request: Request,
    payload: UserCreate,
    db: Session = Depends(get_db),
    login_protection: LoginProtectionService = Depends(get_login_protection),
) -> TokenResponse:
    context = login_protection.before_registration(payload.email, request)
    return register_user(db, payload, context, login_protection, request)


@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    payload: UserLogin,
    db: Session = Depends(get_db),
    login_protection: LoginProtectionService = Depends(get_login_protection),
) -> TokenResponse:
    context = login_protection.before_login(payload.email, request)
    return authenticate_user(db, payload, context, request, login_protection)


@router.post("/refresh", response_model=TokenResponse)
def refresh(request: Request, payload: RefreshTokenRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return rotate_refresh_token(db, payload.refresh_token, request)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    db: Session = Depends(get_db),
    authenticated: AuthenticatedUser = Depends(get_authenticated_user),
) -> Response:
    revoke_session(db, authenticated.user.id, authenticated.session_id, request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
def logout_all(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    revoke_all_user_sessions(db, current_user.id, request, reason="logout_all")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def update_password(
    request: Request,
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    change_password(db, current_user, payload, request)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/admin-check", response_model=UserRead)
def admin_check(current_user: User = Depends(require_admin)) -> User:
    return current_user
