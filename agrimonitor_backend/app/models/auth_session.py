from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def new_uuid() -> str:
    return str(uuid.uuid4())


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        Index("ix_auth_sessions_user_id", "user_id"),
        Index("ix_auth_sessions_family_id", "family_id"),
        Index("ix_auth_sessions_expires_at", "expires_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    family_id: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, default=new_uuid)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoke_reason: Mapped[str | None] = mapped_column(String(80))
    reuse_detected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_agent_hash: Mapped[str | None] = mapped_column(String(64))
    source_ip_hash: Mapped[str | None] = mapped_column(String(64))
    created_by_login: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    user = relationship("User", back_populates="auth_sessions")
    refresh_tokens = relationship(
        "AuthRefreshToken",
        back_populates="session",
        cascade="all, delete-orphan",
        foreign_keys="AuthRefreshToken.session_id",
    )


class AuthRefreshToken(Base):
    __tablename__ = "auth_refresh_tokens"
    __table_args__ = (
        Index("ix_auth_refresh_tokens_session_id", "session_id"),
        Index("ix_auth_refresh_tokens_expires_at", "expires_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    session_id: Mapped[str] = mapped_column(
        ForeignKey("auth_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replaced_by_token_id: Mapped[str | None] = mapped_column(ForeignKey("auth_refresh_tokens.id", ondelete="SET NULL"))

    session = relationship("AuthSession", back_populates="refresh_tokens", foreign_keys=[session_id])
