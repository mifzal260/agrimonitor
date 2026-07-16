import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.core.config import settings
from app.db import base as _models
from app.db.database import get_db
from app.db.startup import prepare_database
from app.api.router import api_router

logging.basicConfig(level=getattr(logging, settings.logging_level.upper(), logging.INFO))
logger = logging.getLogger("agrimonitor")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.prepare_database_on_startup:
        logger.info("Preparing database on startup")
        prepare_database()

    yield


def assert_database_ready(db: Session) -> None:
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Database unavailable") from exc


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled request error", extra={"path": request.url.path})
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    app.include_router(api_router, prefix=settings.api_prefix)

    @app.get("/health", tags=["health"])
    def health_check() -> dict[str, str]:
        return {"status": "ok", "service": settings.app_name}

    @app.get("/health/ready", tags=["health"])
    def readiness_check(db: Session = Depends(get_db)) -> dict[str, str]:
        assert_database_ready(db)
        return {"status": "ready"}

    return app


app = create_app()
