from __future__ import annotations

import hashlib
import logging
import math
import threading
import uuid
from collections import defaultdict, deque
from collections.abc import Callable
from dataclasses import dataclass, field
from time import monotonic
from typing import Protocol

from fastapi import HTTPException, status
from redis import Redis
from redis.exceptions import RedisError
from starlette.requests import Request

from app.core.config import Settings, settings

GENERIC_LOGIN_ERROR = "Nama pengguna atau kata laluan tidak sah."
RATE_LIMIT_ERROR = "Terlalu banyak percubaan log masuk. Sila cuba sebentar lagi."
STORE_UNAVAILABLE_ERROR = "Perkhidmatan log masuk tidak tersedia buat sementara waktu. Sila cuba lagi."

security_logger = logging.getLogger("agrimonitor.security")
Clock = Callable[[], float]


@dataclass(frozen=True)
class LoginProtectionPolicy:
    account_threshold: int
    account_window_seconds: int
    ip_threshold: int
    ip_window_seconds: int
    lockout_base_seconds: int
    lockout_max_seconds: int

    @classmethod
    def from_settings(cls, config: Settings = settings) -> "LoginProtectionPolicy":
        return cls(
            account_threshold=config.login_max_attempts_per_account,
            account_window_seconds=config.login_account_window_seconds,
            ip_threshold=config.login_max_attempts_per_ip,
            ip_window_seconds=config.login_ip_window_seconds,
            lockout_base_seconds=config.login_lockout_base_seconds,
            lockout_max_seconds=config.login_lockout_max_seconds,
        )


@dataclass(frozen=True)
class LoginAttemptContext:
    username: str
    source_ip: str
    user_agent: str | None
    request_id: str | None
    username_hash: str = ""
    source_ip_hash: str = ""

    def __post_init__(self) -> None:
        if not self.username_hash:
            object.__setattr__(self, "username_hash", hash_identifier(normalize_username(self.username)))
        if not self.source_ip_hash:
            object.__setattr__(self, "source_ip_hash", hash_identifier(self.source_ip))


@dataclass(frozen=True)
class AttemptResult:
    allowed: bool
    retry_after_seconds: int = 0
    attempt_count: int = 0
    block_reason: str | None = None


@dataclass(frozen=True)
class FailureResult:
    failure_count: int
    lockout_seconds: int = 0
    lockout_level: int = 0


class LoginProtectionStoreUnavailable(RuntimeError):
    pass


class LoginProtectionStore(Protocol):
    def check_and_record_attempt(
        self,
        username_hash: str,
        source_ip_hash: str,
        member: str,
        policy: LoginProtectionPolicy,
    ) -> AttemptResult: ...

    def record_failure(
        self,
        username_hash: str,
        member: str,
        policy: LoginProtectionPolicy,
    ) -> FailureResult: ...

    def reset_account(self, username_hash: str) -> None: ...

    def ping(self) -> bool: ...

    def close(self) -> None: ...


@dataclass
class MemoryAccountState:
    failure_timestamps: deque[float] = field(default_factory=deque)
    lockout_count: int = 0
    locked_until: float = 0.0

    @property
    def failure_count(self) -> int:
        return len(self.failure_timestamps)


@dataclass
class InMemoryLoginProtectionStore:
    clock: Clock = monotonic
    account_states: dict[str, MemoryAccountState] = field(default_factory=dict)
    ip_attempts: dict[str, deque[float]] = field(default_factory=lambda: defaultdict(deque))
    lock: threading.RLock = field(default_factory=threading.RLock)

    def check_and_record_attempt(
        self,
        username_hash: str,
        source_ip_hash: str,
        member: str,
        policy: LoginProtectionPolicy,
    ) -> AttemptResult:
        del member
        now = self.clock()
        with self.lock:
            self._cleanup(now, policy)
            ip_bucket = self.ip_attempts[source_ip_hash]
            prune_bucket(ip_bucket, now - policy.ip_window_seconds)
            if len(ip_bucket) >= policy.ip_threshold:
                retry_after = seconds_until_oldest_expires(ip_bucket, now, policy.ip_window_seconds)
                return AttemptResult(False, retry_after, len(ip_bucket), "ip_rate_limit")
            ip_bucket.append(now)

            state = self.account_states.get(username_hash)
            if state is not None:
                prune_bucket(state.failure_timestamps, now - policy.account_window_seconds)
                if state.locked_until <= now and not state.failure_timestamps:
                    self.account_states.pop(username_hash, None)
                    state = None
            if state is not None and state.locked_until > now:
                return AttemptResult(False, max(1, math.ceil(state.locked_until - now)), len(ip_bucket), "account_locked")
            return AttemptResult(True, attempt_count=len(ip_bucket))

    def record_failure(
        self,
        username_hash: str,
        member: str,
        policy: LoginProtectionPolicy,
    ) -> FailureResult:
        del member
        now = self.clock()
        with self.lock:
            state = self.account_states.setdefault(username_hash, MemoryAccountState())
            prune_bucket(state.failure_timestamps, now - policy.account_window_seconds)
            if state.locked_until > now:
                return FailureResult(len(state.failure_timestamps), max(1, math.ceil(state.locked_until - now)), state.lockout_count)
            if not state.failure_timestamps and state.locked_until <= now:
                state.lockout_count = 0
            state.failure_timestamps.append(now)
            failure_count = len(state.failure_timestamps)
            if failure_count < policy.account_threshold:
                return FailureResult(failure_count)

            lockout_seconds = calculate_lockout_seconds(state.lockout_count, policy)
            state.lockout_count += 1
            state.locked_until = now + lockout_seconds
            return FailureResult(failure_count, lockout_seconds, state.lockout_count)

    def reset_account(self, username_hash: str) -> None:
        with self.lock:
            self.account_states.pop(username_hash, None)

    def reset(self) -> None:
        with self.lock:
            self.account_states.clear()
            self.ip_attempts.clear()

    def ping(self) -> bool:
        return True

    def close(self) -> None:
        return None

    def _cleanup(self, now: float, policy: LoginProtectionPolicy) -> None:
        for username_hash, state in list(self.account_states.items()):
            prune_bucket(state.failure_timestamps, now - policy.account_window_seconds)
            if state.locked_until <= now and not state.failure_timestamps:
                self.account_states.pop(username_hash, None)
        for source_ip_hash, bucket in list(self.ip_attempts.items()):
            prune_bucket(bucket, now - policy.ip_window_seconds)
            if not bucket:
                self.ip_attempts.pop(source_ip_hash, None)


CHECK_AND_RECORD_ATTEMPT_SCRIPT = """
local now_ms
if tonumber(ARGV[5]) > 0 then
  now_ms = tonumber(ARGV[5])
else
  local redis_time = redis.call('TIME')
  now_ms = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)
end
local ip_window_ms = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now_ms - ip_window_ms)
local ip_count = redis.call('ZCARD', KEYS[1])
if ip_count >= tonumber(ARGV[3]) then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0)
  local oldest_score = tonumber(redis.call('ZSCORE', KEYS[1], oldest[1]))
  local retry_ms = (oldest_score + ip_window_ms) - now_ms
  return {0, math.max(1, math.ceil(retry_ms / 1000)), ip_count, 1}
end
redis.call('ZADD', KEYS[1], now_ms, ARGV[1])
redis.call('PEXPIRE', KEYS[1], ip_window_ms)
ip_count = ip_count + 1

local account_window_ms = tonumber(ARGV[4])
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now_ms - account_window_ms)
local failure_count = redis.call('ZCARD', KEYS[3])
local locked_until = tonumber(redis.call('HGET', KEYS[2], 'locked_until_ms') or '0')
if locked_until <= now_ms and failure_count == 0 then
  redis.call('DEL', KEYS[2])
  locked_until = 0
end
if locked_until > now_ms then
  return {0, math.max(1, math.ceil((locked_until - now_ms) / 1000)), ip_count, 2}
end
return {1, 0, ip_count, 0}
"""

RECORD_FAILURE_SCRIPT = """
local now_ms
if tonumber(ARGV[6]) > 0 then
  now_ms = tonumber(ARGV[6])
else
  local redis_time = redis.call('TIME')
  now_ms = (tonumber(redis_time[1]) * 1000) + math.floor(tonumber(redis_time[2]) / 1000)
end
local account_window_ms = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now_ms - account_window_ms)
local old_count = redis.call('ZCARD', KEYS[2])
local locked_until = tonumber(redis.call('HGET', KEYS[1], 'locked_until_ms') or '0')
if locked_until > now_ms then
  local lockout_level = tonumber(redis.call('HGET', KEYS[1], 'lockout_count') or '1')
  return {old_count, math.max(1, math.ceil((locked_until - now_ms) / 1000)), lockout_level}
end
if old_count == 0 then
  redis.call('DEL', KEYS[1])
end
redis.call('ZADD', KEYS[2], now_ms, ARGV[1])
redis.call('PEXPIRE', KEYS[2], account_window_ms)
local failure_count = old_count + 1
if failure_count < tonumber(ARGV[3]) then
  if redis.call('EXISTS', KEYS[1]) == 1 then
    redis.call('PEXPIRE', KEYS[1], account_window_ms)
  end
  return {failure_count, 0, tonumber(redis.call('HGET', KEYS[1], 'lockout_count') or '0')}
end
local lockout_level = redis.call('HINCRBY', KEYS[1], 'lockout_count', 1)
local lockout_seconds = tonumber(ARGV[4]) * (2 ^ (lockout_level - 1))
lockout_seconds = math.min(lockout_seconds, tonumber(ARGV[5]))
redis.call('HSET', KEYS[1], 'locked_until_ms', now_ms + (lockout_seconds * 1000))
redis.call('PEXPIRE', KEYS[1], math.max(account_window_ms, lockout_seconds * 1000))
return {failure_count, lockout_seconds, lockout_level}
"""


class RedisLoginProtectionStore:
    def __init__(
        self,
        client: Redis,
        key_prefix: str,
        *,
        clock_ms: Callable[[], int] | None = None,
        owns_client: bool = False,
    ) -> None:
        self.client = client
        self.key_prefix = key_prefix.rstrip(":")
        self.clock_ms = clock_ms
        self.owns_client = owns_client
        self._check_script = client.register_script(CHECK_AND_RECORD_ATTEMPT_SCRIPT)
        self._failure_script = client.register_script(RECORD_FAILURE_SCRIPT)

    @classmethod
    def from_settings(cls, config: Settings = settings) -> "RedisLoginProtectionStore":
        if not config.redis_url:
            raise ValueError("Redis configuration is incomplete")
        client = Redis.from_url(
            config.redis_url,
            socket_timeout=config.redis_socket_timeout_seconds,
            socket_connect_timeout=config.redis_connect_timeout_seconds,
            health_check_interval=config.redis_health_check_interval_seconds,
            max_connections=config.redis_max_connections,
            decode_responses=True,
        )
        return cls(client, config.redis_key_prefix, owns_client=True)

    def check_and_record_attempt(
        self,
        username_hash: str,
        source_ip_hash: str,
        member: str,
        policy: LoginProtectionPolicy,
    ) -> AttemptResult:
        keys = [self.ip_key(source_ip_hash), self.account_key(username_hash), self.failures_key(username_hash)]
        args = [
            member,
            policy.ip_window_seconds * 1000,
            policy.ip_threshold,
            policy.account_window_seconds * 1000,
            self._now_override(),
        ]
        values = self._execute(self._check_script, keys, args)
        reason_code = self._integer(values, 3)
        reason = {1: "ip_rate_limit", 2: "account_locked"}.get(reason_code)
        return AttemptResult(bool(self._integer(values, 0)), self._integer(values, 1), self._integer(values, 2), reason)

    def record_failure(
        self,
        username_hash: str,
        member: str,
        policy: LoginProtectionPolicy,
    ) -> FailureResult:
        keys = [self.account_key(username_hash), self.failures_key(username_hash)]
        args = [
            member,
            policy.account_window_seconds * 1000,
            policy.account_threshold,
            policy.lockout_base_seconds,
            policy.lockout_max_seconds,
            self._now_override(),
        ]
        values = self._execute(self._failure_script, keys, args)
        return FailureResult(self._integer(values, 0), self._integer(values, 1), self._integer(values, 2))

    def reset_account(self, username_hash: str) -> None:
        try:
            self.client.delete(self.account_key(username_hash), self.failures_key(username_hash))
        except RedisError as exc:
            raise LoginProtectionStoreUnavailable("Login protection store unavailable") from exc

    def ping(self) -> bool:
        try:
            return bool(self.client.ping())
        except RedisError as exc:
            raise LoginProtectionStoreUnavailable("Login protection store unavailable") from exc

    def close(self) -> None:
        if self.owns_client:
            try:
                self.client.close()
            except RedisError:
                security_logger.warning("login_protection_store_close_failed")

    def account_key(self, username_hash: str) -> str:
        return f"{self.key_prefix}:account:{username_hash}"

    def failures_key(self, username_hash: str) -> str:
        return f"{self.key_prefix}:failures:{username_hash}"

    def ip_key(self, source_ip_hash: str) -> str:
        return f"{self.key_prefix}:ip:{source_ip_hash}"

    def _now_override(self) -> int:
        return self.clock_ms() if self.clock_ms is not None else 0

    def _execute(self, script: object, keys: list[str], args: list[object]) -> object:
        try:
            return script(keys=keys, args=args)
        except RedisError as exc:
            raise LoginProtectionStoreUnavailable("Login protection store unavailable") from exc

    @staticmethod
    def _integer(values: object, index: int) -> int:
        if not isinstance(values, (list, tuple)) or len(values) not in {3, 4} or index >= len(values):
            raise LoginProtectionStoreUnavailable("Malformed login protection store response")
        value = values[index]
        if isinstance(value, bool) or not isinstance(value, (int, str, bytes)):
            raise LoginProtectionStoreUnavailable("Malformed login protection store response")
        try:
            return int(value)
        except (TypeError, ValueError) as exc:
            raise LoginProtectionStoreUnavailable("Malformed login protection store response") from exc


@dataclass
class LoginProtectionService:
    store: LoginProtectionStore
    config: Settings = field(default_factory=lambda: settings)

    def before_login(self, username: str, request: Request) -> LoginAttemptContext:
        normalized_username = normalize_username(username)
        source_ip = get_source_ip(request, self.config)
        context = LoginAttemptContext(
            username=normalized_username,
            username_hash=hash_identifier(normalized_username),
            source_ip=source_ip,
            source_ip_hash=hash_identifier(source_ip),
            user_agent=request.headers.get("user-agent"),
            request_id=request.headers.get("x-request-id"),
        )
        if not self.config.login_rate_limit_enabled:
            return context
        try:
            result = self.store.check_and_record_attempt(
                context.username_hash,
                context.source_ip_hash,
                unique_member(),
                LoginProtectionPolicy.from_settings(self.config),
            )
        except LoginProtectionStoreUnavailable as exc:
            self._store_unavailable(context, exc)
        if not result.allowed:
            event = "login_rate_limit_hit" if result.block_reason == "ip_rate_limit" else "login_locked_attempt"
            reason = result.block_reason or "account_locked"
            self._log(event, context, failure_reason=reason, attempt_count=result.attempt_count, lockout_seconds=result.retry_after_seconds)
            raise_rate_limit(result.retry_after_seconds)
        return context

    def record_success(self, context: LoginAttemptContext) -> None:
        if self.config.login_rate_limit_enabled:
            try:
                self.store.reset_account(context.username_hash)
            except LoginProtectionStoreUnavailable as exc:
                self._store_unavailable(context, exc)
        self._log("login_success", context)

    def record_failure(self, context: LoginAttemptContext, reason: str) -> None:
        if not self.config.login_rate_limit_enabled:
            self._log("login_failed", context, failure_reason=reason)
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_LOGIN_ERROR)
        try:
            result = self.store.record_failure(
                context.username_hash,
                unique_member(),
                LoginProtectionPolicy.from_settings(self.config),
            )
        except LoginProtectionStoreUnavailable as exc:
            self._store_unavailable(context, exc)
        if result.lockout_seconds:
            self._log("login_account_locked", context, failure_reason=reason, attempt_count=result.failure_count, lockout_seconds=result.lockout_seconds)
            raise_rate_limit(result.lockout_seconds)
        self._log("login_failed", context, failure_reason=reason, attempt_count=result.failure_count)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=GENERIC_LOGIN_ERROR)

    def ready(self) -> bool:
        if not self.config.login_rate_limit_enabled:
            return True
        if not self.store.ping():
            raise LoginProtectionStoreUnavailable("Login protection store unavailable")
        return True

    def close(self) -> None:
        self.store.close()

    def _store_unavailable(self, context: LoginAttemptContext, exc: Exception) -> None:
        security_logger.error(
            "security_event",
            extra={
                "event": "login_protection_store_unavailable",
                "username_hash": context.username_hash,
                "source_ip": context.source_ip,
                "request_id": context.request_id,
            },
        )
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=STORE_UNAVAILABLE_ERROR) from exc

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
                "username_hash": context.username_hash,
                "source_ip": context.source_ip,
                "user_agent": context.user_agent,
                "request_id": context.request_id,
                "failure_reason": failure_reason,
                "attempt_count": attempt_count,
                "lockout_seconds": lockout_seconds,
            },
        )


_default_memory_store = InMemoryLoginProtectionStore()
login_rate_limiter = LoginProtectionService(store=_default_memory_store, config=settings)


def build_login_protection_service(config: Settings = settings) -> LoginProtectionService:
    if config.login_protection_store == "redis":
        store: LoginProtectionStore = RedisLoginProtectionStore.from_settings(config)
        return LoginProtectionService(store=store, config=config)
    login_rate_limiter.config = config
    return login_rate_limiter


def reset_login_rate_limiter() -> None:
    _default_memory_store.reset()


def set_login_rate_limiter_clock(clock: Clock) -> None:
    _default_memory_store.clock = clock


def normalize_username(username: str) -> str:
    return username.strip().lower()


def hash_identifier(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def unique_member() -> str:
    return uuid.uuid4().hex


def calculate_lockout_seconds(lockout_count: int, policy: LoginProtectionPolicy) -> int:
    return min(policy.lockout_base_seconds * (2**lockout_count), policy.lockout_max_seconds)


def prune_bucket(bucket: deque[float], cutoff: float) -> None:
    while bucket and bucket[0] <= cutoff:
        bucket.popleft()


def seconds_until_oldest_expires(bucket: deque[float], now: float, window_seconds: int) -> int:
    if not bucket:
        return window_seconds
    return max(1, math.ceil(bucket[0] + window_seconds - now))


def get_source_ip(request: Request, config: Settings = settings) -> str:
    client_host = request.client.host if request.client else "unknown"
    if client_host in config.trusted_proxy_ips:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",", maxsplit=1)[0].strip() or client_host
    return client_host


def raise_rate_limit(retry_after: int) -> None:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=RATE_LIMIT_ERROR,
        headers={"Retry-After": str(max(1, int(retry_after)))},
    )
