from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.db.database import get_db
from app.services.login_protection import LoginProtectionStoreUnavailable

router = APIRouter()


@router.get("")
def api_health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/ready")
def api_readiness_check(request: Request, db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable") from exc
    try:
        request.app.state.login_protection.ready()
    except LoginProtectionStoreUnavailable as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Login protection unavailable") from exc
    return {"status": "ready"}
