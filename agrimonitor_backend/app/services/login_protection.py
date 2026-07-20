from __future__ import annotations

import hashlib
import logging
import threading
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass, field
from time import monotonic

from fastapi import HTTPException, status
from starlette.requests import Request

from app.core.config import settings

GENERIC_LOGIN_ERROR = "Nama pengguna atau kata laluan tidak sah."
RATE_LIMIT_ERROR = "Terlalu banyak percubaan log masuk. Sila cuba sebentar lagi."

security_logger = logging.getLogger("agrimonitor.security")
Clock = Callable[[], float]


@dataclass
class LoginAttemptContext:
    username: str
    source_ip: str
    user_agent: str | None
    request_id: str | None


@dataclass
class AccountState:
    failure_count: int = 0
    failure_timestamps: deque[float] = field(default_factory=deque)
    lockout_count: int = 0
    locked_until: float = 0.0


@dataclass
class LoginRateLimiter:
    clock: Clock = monotonic
    account_states: dict[str, AccountState] = field(default_factory=dict)
    account_ip_failures: dict[str, deque[float]] = field(default_factory=lambda: defaultdict(deque))
    ip_attempts: dict[str, deque[float]] = field(default_factory=lambda: defaultdict(deque))
    lock: threading.RLock = field(default_factory=threading.RLock)

    def before_login(self, username: str, request: Request) -> LoginAttemptContext:
        context = LoginAttemptContext(
            username=normalize_username(username),
            source_ip=get_source_ip(request),
            user_agent=request.headers.get("user-agent"),
            request_id=request.headers.get("x-request-id"),
        )
        if not settings.login_rate_limit_enabled:
            return context

        now = self.clock()
        with self.lock:
            self._cleanup_expired_state(now)
            ip_bucket = self.ip_attempts[context.source_ip]
            prune_bucket(ip_bucket, now - settings.login_ip_window_seconds)
            if len(ip_bucket) >= settings.login_max_attempts_per_ip:
                retry_after = seconds_until_oldest_expires(ip_bucket, now, settings.login_ip_window_seconds)
                self._log(
                    "login_rate_limit_hit",
                    context,
                    failure_reason="ip_rate_limit",
                    attempt_count=len(ip_bucket),
                    lockout_seconds=retry_after,
                )
                raise_rate_limit(retry_after)
            ip_bucket.append(now)

            state = self.account_states.get(context.username)
            if state:
                prune_account_failures(state, now)
            if state and state.locked_until > now:
                retry_after = int(state.locked_until - now) + 1
                self._log(
                    "login_locked_attempt",
                    context,
                    failure_reason="account_locked",
                    attempt_count=state.failure_count,
                    lockout_seconds=retry_after,
                )
                raise_rate_limit(retry_after)

        return context

    def record_success(self, context: LoginAttemptContext) -> None:
        if not settings.login_rate_limit_enabled:
            self._log("login_success", context)
            return

        with self.lock:
            self.account_states.pop(context.username, None)
            self.account_ip_failures.pop(account_ip_key(context.username, context.source_ip), None)
        self._log("login_success", context)

    def record_failure(self, context: LoginAttemptContext, reason: str) -> None:
        if not settings.login_rate_limit_enabled:
            self._log("login_failed", context, failure_reason=reason)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_LOGIN_ERROR)

        now = self.clock()
        with self.lock:
            failure_key = account_ip_key(context.username, context.source_ip)
            failure_bucket = self.account_ip_failures[failure_key]
            prune_bucket(failure_bucket, now - settings.login_account_window_seconds)
            failure_bucket.append(now)

            state = self.account_states.setdefault(context.username, AccountState())
            prune_account_failures(state, now)
            state.failure_timestamps.append(now)
            state.failure_count = len(state.failure_timestamps)

            if state.failure_count >= settings.login_max_attempts_per_account:
                lockout_seconds = min(
                    settings.login_lockout_base_seconds * (2 ** state.lockout_count),
                    settings.login_lockout_max_seconds,
                )
                state.lockout_count += 1
                state.locked_until = now + lockout_seconds
                self._log(
                    "login_account_locked",
                    context,
                    failure_reason=reason,
                    attempt_count=state.failure_count,
                    lockout_seconds=lockout_seconds,
                )
                raise_rate_limit(lockout_seconds)

            self._log(
                "login_failed",
                context,
                failure_reason=reason,
                attempt_count=state.failure_count,
            )

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_LOGIN_ERROR)

    def reset(self) -> None:
        with self.lock:
            self.account_states.clear()
            self.account_ip_failures.clear()
            self.ip_attempts.clear()

    def _cleanup_expired_state(self, now: float) -> None:
        stale_usernames: list[str] = []
        for username, state in self.account_states.items():
            prune_account_failures(state, now)
            if state.locked_until <= now and not state.failure_timestamps:
                stale_usernames.append(username)

        for username in stale_usernames:
            self.account_states.pop(username, None)

        stale_failure_keys: list[str] = []
        for key, bucket in self.account_ip_failures.items():
            prune_bucket(bucket, now - settings.login_account_window_seconds)
            if not bucket:
                stale_failure_keys.append(key)

        for key in stale_failure_keys:
            self.account_ip_failures.pop(key, None)

        stale_ip_keys: list[str] = []
        for key, bucket in self.ip_attempts.items():
            prune_bucket(bucket, now - settings.login_ip_window_seconds)
            if not bucket:
                stale_ip_keys.append(key)

        for key in stale_ip_keys:
            self.ip_attempts.pop(key, None)

    def _log(
        self,
        event: str,
        context: LoginAttemptContext,
        *,
        failure_reason: str | None = None,
        attempt_count: int | None = None,
        lockout_seconds: int | None = None,
    ) -> None:
        security_logger.info(
            "security_event",
            extra={
                "event": event,
                "username_hash": hash_username(context.username),
                "source_ip": context.source_ip,
                "user_agent": context.user_agent,
                "request_id": context.request_id,
                "failure_reason": failure_reason,
                "attempt_count": attempt_count,
                "lockout_seconds": lockout_seconds,
            },
        )


def normalize_username(username: str) -> str:
    return username.strip().lower()


def hash_username(username: str) -> str:
    return hashlib.sha256(normalize_username(username).encode("utf-8")).hexdigest()[:16]


def account_ip_key(username: str, source_ip: str) -> str:
    return f"{normalize_username(username)}|{source_ip}"


def prune_bucket(bucket: deque[float], cutoff: float) -> None:
    while bucket and bucket[0] <= cutoff:
        bucket.popleft()


def prune_account_failures(state: AccountState, now: float) -> None:
    prune_bucket(state.failure_timestamps, now - settings.login_account_window_seconds)
    state.failure_count = len(state.failure_timestamps)


def seconds_until_oldest_expires(bucket: deque[float], now: float, window_seconds: int) -> int:
    if not bucket:
        return window_seconds
    return max(1, int(bucket[0] + window_seconds - now) + 1)


def get_source_ip(request: Request) -> str:
    client_host = request.client.host if request.client else "unknown"
    if client_host in settings.trusted_proxy_ips:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",", maxsplit=1)[0].strip() or client_host
    return client_host


def raise_rate_limit(retry_after: int) -> None:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=RATE_LIMIT_ERROR,
        headers={"Retry-After": str(max(1, retry_after))},
    )


login_rate_limiter = LoginRateLimiter()


def reset_login_rate_limiter() -> None:
    login_rate_limiter.reset()


def set_login_rate_limiter_clock(clock: Clock) -> None:
    login_rate_limiter.clock = clock
