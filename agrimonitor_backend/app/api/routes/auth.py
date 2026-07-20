from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.core.dependencies import get_current_user, require_admin
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse, UserCreate, UserLogin, UserRead
from app.services.auth_service import authenticate_user, register_user
from app.services.login_protection import login_rate_limiter

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)) -> TokenResponse:
    return register_user(db, payload)


@router.post("/login", response_model=TokenResponse)
def login(request: Request, payload: UserLogin, db: Session = Depends(get_db)) -> TokenResponse:
    context = login_rate_limiter.before_login(payload.email, request)
    return authenticate_user(db, payload, context)


@router.get("/me", response_model=UserRead)
def read_current_user(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.get("/admin-check", response_model=UserRead)
def admin_check(current_user: User = Depends(require_admin)) -> User:
    return current_user
