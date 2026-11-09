from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, hash_refresh_token
from app.models.auth_session import AuthRefreshToken, AuthSession
from app.models.user import User
from app.schemas.auth import TokenResponse
from app.services.login_protection import get_source_ip, hash_identifier

GENERIC_REFRESH_ERROR = "Sesi tidak sah atau telah tamat tempoh."
SESSION_STORE_UNAVAILABLE_ERROR = "Perkhidmatan sesi tidak tersedia buat sementara waktu."
security_logger = logging.getLogger("agrimonitor.security")


def utc_now() -> datetime:
    return datetime.now(UTC)


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def is_session_active(db: Session, user_id: int, session_id: str) -> bool:
    try:
        return (
            db.scalar(
                select(AuthSession.id).where(
                    AuthSession.id == session_id,
                    AuthSession.user_id == user_id,
                    AuthSession.revoked_at.is_(None),
                    AuthSession.expires_at > utc_now(),
                )
            )
            is not None
        )
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=SESSION_STORE_UNAVAILABLE_ERROR,
        ) from exc


def create_session_tokens(
    db: Session,
    user: User,
    request: Request,
    *,
    created_by_login: bool,
) -> TokenResponse:
    now = utc_now()
    try:
        locked_user = db.get(User, user.id, with_for_update=True)
        if locked_user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_REFRESH_ERROR)
        _delete_expired_for_user(db, user.id, now)
        active_sessions = list(
            db.scalars(
                select(AuthSession)
                .where(
                    AuthSession.user_id == user.id,
                    AuthSession.revoked_at.is_(None),
                    AuthSession.expires_at > now,
                )
                .order_by(AuthSession.last_used_at.asc(), AuthSession.created_at.asc())
                .with_for_update()
            ).all()
        )
        revoke_count = max(0, len(active_sessions) - settings.max_active_sessions_per_user + 1)
        for old_session in active_sessions[:revoke_count]:
            _mark_session_revoked(db, old_session, now, "max_session_limit")

        expires_at = now + timedelta(days=settings.refresh_token_expire_days)
        session = AuthSession(
            user_id=user.id,
            expires_at=expires_at,
            last_used_at=now,
            user_agent_hash=_header_hash(request, "user-agent"),
            source_ip_hash=hash_identifier(get_source_ip(request, settings)),
            created_by_login=created_by_login,
        )
        raw_refresh_token = create_refresh_token()
        refresh_token = AuthRefreshToken(
            session=session,
            token_hash=hash_refresh_token(raw_refresh_token),
            expires_at=expires_at,
        )
        db.add_all([session, refresh_token])
        db.flush()
        access_token = create_access_token(str(user.id), session.id)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        _log_event("session_creation_failed", request, user_id=user.id, reason="session_store_unavailable")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=SESSION_STORE_UNAVAILABLE_ERROR) from exc
    except Exception:
        db.rollback()
        raise

    if revoke_count:
        _log_event("max_session_limit_enforced", request, user_id=user.id, reason="oldest_session_revoked")
    _log_event("session_created", request, user_id=user.id, session_id=session.id)
    return _token_response(access_token, raw_refresh_token, user)


def rotate_refresh_token(db: Session, raw_token: str, request: Request) -> TokenResponse:
    if not raw_token or len(raw_token) > 512:
        _log_event("refresh_failed", request, reason="invalid_token")
        raise _refresh_unauthorized()
    now = utc_now()
    token_hash = hash_refresh_token(raw_token)
    try:
        refresh_token = db.scalar(
            select(AuthRefreshToken)
            .where(AuthRefreshToken.token_hash == token_hash)
            .with_for_update()
        )
        if refresh_token is None:
            db.rollback()
            _log_event("refresh_failed", request, reason="invalid_token")
            raise _refresh_unauthorized()
        auth_session = db.get(AuthSession, refresh_token.session_id, with_for_update=True)
        if auth_session is None:
            db.rollback()
            _log_event("refresh_failed", request, reason="invalid_session")
            raise _refresh_unauthorized()

        if refresh_token.used_at is not None:
            if settings.refresh_token_reuse_detection_enabled:
                auth_session.reuse_detected_at = now
                _mark_session_revoked(db, auth_session, now, "refresh_token_reuse")
                db.commit()
                _log_event(
                    "refresh_token_reuse_detected",
                    request,
                    user_id=auth_session.user_id,
                    session_id=auth_session.id,
                    reason="replay",
                )
            else:
                db.rollback()
            raise _refresh_unauthorized()

        invalid_reason = _refresh_invalid_reason(refresh_token, auth_session, now)
        if invalid_reason:
            db.rollback()
            _log_event(
                "refresh_failed",
                request,
                user_id=auth_session.user_id,
                session_id=auth_session.id,
                reason=invalid_reason,
            )
            raise _refresh_unauthorized()

        consumed = db.execute(
            update(AuthRefreshToken)
            .where(
                AuthRefreshToken.id == refresh_token.id,
                AuthRefreshToken.used_at.is_(None),
                AuthRefreshToken.revoked_at.is_(None),
            )
            .values(used_at=now)
        )
        if consumed.rowcount != 1:
            auth_session.reuse_detected_at = now
            _mark_session_revoked(db, auth_session, now, "refresh_token_reuse")
            db.commit()
            _log_event(
                "refresh_token_reuse_detected",
                request,
                user_id=auth_session.user_id,
                session_id=auth_session.id,
                reason="concurrent_replay",
            )
            raise _refresh_unauthorized()

        new_raw_token = create_refresh_token()
        new_refresh_token = AuthRefreshToken(
            session_id=auth_session.id,
            token_hash=hash_refresh_token(new_raw_token),
            expires_at=auth_session.expires_at,
        )
        db.add(new_refresh_token)
        db.flush()
        refresh_token.replaced_by_token_id = new_refresh_token.id
        auth_session.last_used_at = now
        user = db.get(User, auth_session.user_id)
        if user is None:
            _mark_session_revoked(db, auth_session, now, "user_missing")
            db.commit()
            raise _refresh_unauthorized()
        access_token = create_access_token(str(user.id), auth_session.id)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        _log_event("refresh_failed", request, reason="session_store_unavailable")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=SESSION_STORE_UNAVAILABLE_ERROR) from exc
    except Exception:
        db.rollback()
        raise

    _log_event("refresh_success", request, user_id=user.id, session_id=auth_session.id)
    return _token_response(access_token, new_raw_token, user)


def revoke_session(db: Session, user_id: int, session_id: str | None, request: Request, reason: str = "logout") -> None:
    if not session_id:
        _log_event("logout_success", request, user_id=user_id, reason="legacy_access_token")
        return
    now = utc_now()
    try:
        auth_session = db.scalar(
            select(AuthSession)
            .where(AuthSession.id == session_id, AuthSession.user_id == user_id)
            .with_for_update()
        )
        was_revoked = auth_session is not None and auth_session.revoked_at is None
        if was_revoked:
            _mark_session_revoked(db, auth_session, now, reason)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=SESSION_STORE_UNAVAILABLE_ERROR) from exc
    if was_revoked:
        _log_event("session_revoked", request, user_id=user_id, session_id=session_id, reason=reason)
    _log_event("logout_success", request, user_id=user_id, session_id=session_id)


def revoke_all_user_sessions(db: Session, user_id: int, request: Request, reason: str) -> int:
    now = utc_now()
    try:
        sessions = list(
            db.scalars(
                select(AuthSession)
                .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
                .with_for_update()
            ).all()
        )
        for auth_session in sessions:
            _mark_session_revoked(db, auth_session, now, reason)
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=SESSION_STORE_UNAVAILABLE_ERROR) from exc
    event = "sessions_revoked_password_change" if reason == "password_changed" else "logout_all"
    _log_event(event, request, user_id=user_id, reason=reason)
    return len(sessions)


def cleanup_expired_sessions(db: Session, batch_size: int | None = None) -> int:
    limit = batch_size or settings.session_cleanup_batch_size
    now = utc_now()
    session_ids = list(
        db.scalars(
            select(AuthSession.id)
            .where(AuthSession.expires_at <= now)
            .order_by(AuthSession.expires_at.asc())
            .limit(limit)
        ).all()
    )
    if not session_ids:
        return 0
    db.execute(delete(AuthRefreshToken).where(AuthRefreshToken.session_id.in_(session_ids)))
    db.execute(delete(AuthSession).where(AuthSession.id.in_(session_ids)))
    db.commit()
    _log_event("session_cleanup", None, reason=f"deleted:{len(session_ids)}")
    return len(session_ids)


def _delete_expired_for_user(db: Session, user_id: int, now: datetime) -> None:
    expired_ids = list(
        db.scalars(
            select(AuthSession.id).where(
                AuthSession.user_id == user_id,
                AuthSession.expires_at <= now,
            )
        ).all()
    )
    if expired_ids:
        db.execute(delete(AuthRefreshToken).where(AuthRefreshToken.session_id.in_(expired_ids)))
        db.execute(delete(AuthSession).where(AuthSession.id.in_(expired_ids)))


def _mark_session_revoked(db: Session, auth_session: AuthSession, now: datetime, reason: str) -> None:
    auth_session.revoked_at = auth_session.revoked_at or now
    auth_session.revoke_reason = auth_session.revoke_reason or reason
    db.execute(
        update(AuthRefreshToken)
        .where(
            AuthRefreshToken.session_id == auth_session.id,
            AuthRefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )


def _refresh_invalid_reason(token: AuthRefreshToken, auth_session: AuthSession, now: datetime) -> str | None:
    if token.revoked_at is not None or auth_session.revoked_at is not None:
        return "revoked"
    if as_utc(token.expires_at) <= now or as_utc(auth_session.expires_at) <= now:
        return "expired"
    return None


def _token_response(access_token: str, refresh_token: str, user: User) -> TokenResponse:
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
        refresh_expires_in=settings.refresh_token_expire_days * 86_400,
        user=user,
    )


def _refresh_unauthorized() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_REFRESH_ERROR)


def _header_hash(request: Request, header: str) -> str | None:
    value = request.headers.get(header)
    return hash_identifier(value) if value else None


def _log_event(
    event: str,
    request: Request | None,
    *,
    user_id: int | None = None,
    session_id: str | None = None,
    reason: str | None = None,
) -> None:
    try:
        security_logger.info(
            "security_event",
            extra={
                "event": event,
                "user_identifier": hash_identifier(str(user_id)) if user_id is not None else None,
                "username_hash": hash_identifier(str(user_id)) if user_id is not None else None,
                "session_identifier": hash_identifier(session_id) if session_id else None,
                "source_ip_hash": hash_identifier(get_source_ip(request, settings)) if request is not None else None,
                "request_id": request.headers.get("x-request-id") if request is not None else None,
                "failure_reason": reason,
            },
        )
    except Exception:
        return
