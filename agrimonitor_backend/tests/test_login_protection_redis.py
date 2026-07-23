from concurrent.futures import ThreadPoolExecutor

import fakeredis
import pytest
from fastapi import HTTPException
from redis.exceptions import ConnectionError
from starlette.requests import Request

from app.core.config import Settings
from app.services.login_protection import (
    InMemoryLoginProtectionStore,
    LoginProtectionPolicy,
    RegistrationProtectionPolicy,
    LoginProtectionService,
    LoginProtectionStoreUnavailable,
    RedisLoginProtectionStore,
    hash_identifier,
    normalize_username,
)


class FakeClock:
    def __init__(self, now_ms: int = 1_000_000) -> None:
        self.now_ms = now_ms

    def __call__(self) -> int:
        return self.now_ms

    def advance(self, seconds: int) -> None:
        self.now_ms += seconds * 1000


def policy(**overrides: int) -> LoginProtectionPolicy:
    values = {
        "account_threshold": 5,
        "account_window_seconds": 300,
        "ip_threshold": 15,
        "ip_window_seconds": 900,
        "lockout_base_seconds": 60,
        "lockout_max_seconds": 1800,
    }
    values.update(overrides)
    return LoginProtectionPolicy(**values)


def registration_policy(**overrides: int) -> RegistrationProtectionPolicy:
    values = {
        "email_threshold": 5,
        "email_window_seconds": 1800,
        "ip_threshold": 10,
        "ip_window_seconds": 3600,
    }
    values.update(overrides)
    return RegistrationProtectionPolicy(**values)


def shared_stores(clock: FakeClock) -> tuple[fakeredis.FakeRedis, RedisLoginProtectionStore, RedisLoginProtectionStore]:
    server = fakeredis.FakeServer()
    first_client = fakeredis.FakeRedis(server=server, decode_responses=True)
    second_client = fakeredis.FakeRedis(server=server, decode_responses=True)
    return (
        first_client,
        RedisLoginProtectionStore(first_client, "test:login", clock_ms=clock),
        RedisLoginProtectionStore(second_client, "test:login", clock_ms=clock),
    )


def request_for(ip: str = "198.51.100.10") -> Request:
    return Request({"type": "http", "method": "POST", "path": "/login", "headers": [], "client": (ip, 1234)})


def service_config(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "jwt_secret_key": "local-test-secret",
        "login_max_attempts_per_account": 5,
        "login_account_window_seconds": 300,
        "login_max_attempts_per_ip": 15,
        "login_ip_window_seconds": 900,
        "login_lockout_base_seconds": 60,
        "login_lockout_max_seconds": 1800,
        "_env_file": None,
    }
    values.update(overrides)
    return Settings(**values)


def test_memory_store_still_enforces_lockout() -> None:
    store = InMemoryLoginProtectionStore(clock=lambda: 1000.0)
    result = None
    for index in range(5):
        result = store.record_failure("user-hash", str(index), policy())
    assert result is not None
    assert result.lockout_seconds == 60


def test_account_failures_are_shared_between_redis_store_instances() -> None:
    _, first, second = shared_stores(FakeClock())
    for index in range(4):
        assert first.record_failure("user-hash", str(index), policy()).lockout_seconds == 0
    assert second.record_failure("user-hash", "threshold", policy()).lockout_seconds == 60


def test_ip_attempts_are_shared_between_redis_store_instances() -> None:
    _, first, second = shared_stores(FakeClock())
    limited_policy = policy(ip_threshold=2)
    assert first.check_and_record_attempt("u1", "ip-hash", "1", limited_policy).allowed
    assert second.check_and_record_attempt("u2", "ip-hash", "2", limited_policy).allowed
    result = first.check_and_record_attempt("u3", "ip-hash", "3", limited_policy)
    assert not result.allowed
    assert result.retry_after_seconds == 900


def test_concurrent_failures_lock_once_at_exact_threshold() -> None:
    client, first, second = shared_stores(FakeClock())
    stores = [first, second]

    def fail(index: int):
        return stores[index % 2].record_failure("user-hash", str(index), policy())

    with ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(fail, range(12)))

    assert sum(result.lockout_seconds == 0 for result in results) == 4
    assert {result.lockout_seconds for result in results if result.lockout_seconds} == {60}
    assert client.zcard(first.failures_key("user-hash")) == 5
    assert client.hget(first.account_key("user-hash"), "lockout_count") == "1"


def test_lockout_progression_is_shared_and_capped() -> None:
    _, first, second = shared_stores(FakeClock())
    clock = first.clock_ms
    assert isinstance(clock, FakeClock)
    one_attempt = policy(account_threshold=1, lockout_base_seconds=60, lockout_max_seconds=90)
    assert first.record_failure("user-hash", "1", one_attempt).lockout_seconds == 60
    clock.advance(61)
    assert second.record_failure("user-hash", "2", one_attempt).lockout_seconds == 90
    clock.advance(91)
    assert first.record_failure("user-hash", "3", one_attempt).lockout_seconds == 90


def test_success_resets_account_but_not_ip_state() -> None:
    client, first, _ = shared_stores(FakeClock())
    first.check_and_record_attempt("user-hash", "ip-hash", "ip-1", policy())
    first.record_failure("user-hash", "failure-1", policy())
    first.reset_account("user-hash")
    assert not client.exists(first.account_key("user-hash"))
    assert not client.exists(first.failures_key("user-hash"))
    assert client.exists(first.ip_key("ip-hash"))


def test_every_redis_key_has_ttl_and_contains_only_hashes() -> None:
    client, first, _ = shared_stores(FakeClock())
    username = "Farmer@example.com"
    username_hash = hash_identifier(normalize_username(username))
    ip_hash = hash_identifier("198.51.100.10")
    first.check_and_record_attempt(username_hash, ip_hash, "attempt", policy(account_threshold=1))
    first.record_failure(username_hash, "failure", policy(account_threshold=1))
    keys = [str(key) for key in client.scan_iter(match="test:login:*")]
    assert keys
    assert all(client.pttl(key) > 0 for key in keys)
    serialized = " ".join(keys + [str(client.dump(key)) for key in keys])
    assert username.lower() not in serialized.lower()
    assert "password" not in serialized.lower()
    assert "bearer" not in serialized.lower()


def test_expired_account_window_is_not_counted() -> None:
    clock = FakeClock()
    _, first, _ = shared_stores(clock)
    short = policy(account_threshold=3, account_window_seconds=10)
    first.record_failure("user-hash", "1", short)
    first.record_failure("user-hash", "2", short)
    clock.advance(11)
    result = first.record_failure("user-hash", "3", short)
    assert result.failure_count == 1
    assert result.lockout_seconds == 0


def test_expired_lockout_allows_next_attempt() -> None:
    clock = FakeClock()
    _, first, _ = shared_stores(clock)
    one_attempt = policy(account_threshold=1)
    first.record_failure("user-hash", "1", one_attempt)
    locked = first.check_and_record_attempt("user-hash", "ip-hash", "ip-1", one_attempt)
    assert not locked.allowed
    clock.advance(61)
    assert first.check_and_record_attempt("user-hash", "ip-hash", "ip-2", one_attempt).allowed


def test_normalized_username_produces_same_private_key() -> None:
    first_hash = hash_identifier(normalize_username(" Farmer@Example.com "))
    second_hash = hash_identifier(normalize_username("farmer@example.com"))
    _, store, _ = shared_stores(FakeClock())
    assert first_hash == second_hash
    assert store.account_key(first_hash) == store.account_key(second_hash)
    assert "farmer@example.com" not in store.account_key(first_hash)


def test_store_unavailable_returns_controlled_503_and_security_log(caplog: pytest.LogCaptureFixture) -> None:
    server = fakeredis.FakeServer()
    server.connected = False
    client = fakeredis.FakeRedis(server=server, decode_responses=True)
    store = RedisLoginProtectionStore(client, "test:login")
    service = LoginProtectionService(store=store, config=service_config())

    with caplog.at_level("ERROR", logger="agrimonitor.security"), pytest.raises(HTTPException) as caught:
        service.before_login("farmer@example.com", request_for())

    assert caught.value.status_code == 503
    assert "Redis" not in str(caught.value.detail)
    assert any(record.__dict__.get("event") == "login_protection_store_unavailable" for record in caplog.records)
    assert isinstance(store.client.connection_pool.connection_kwargs, dict)


def test_fail_closed_does_not_fallback_to_memory() -> None:
    server = fakeredis.FakeServer()
    server.connected = False
    store = RedisLoginProtectionStore(fakeredis.FakeRedis(server=server), "test:login")
    service = LoginProtectionService(store=store, config=service_config())
    with pytest.raises(HTTPException) as caught:
        service.before_login("farmer@example.com", request_for())
    assert caught.value.status_code == 503
    assert service.store is store


def test_malformed_redis_response_cannot_bypass_protection(monkeypatch: pytest.MonkeyPatch) -> None:
    client = fakeredis.FakeRedis(decode_responses=True)
    store = RedisLoginProtectionStore(client, "test:login")
    monkeypatch.setattr(store, "_check_script", lambda **kwargs: [1, 0, 1])
    with pytest.raises(LoginProtectionStoreUnavailable):
        store.check_and_record_attempt("u", "ip", "member", policy())


def test_redis_ping_failure_is_wrapped_without_url() -> None:
    class BrokenClient:
        def ping(self) -> bool:
            raise ConnectionError("redis://user:secret@example.invalid")

    store = RedisLoginProtectionStore.__new__(RedisLoginProtectionStore)
    store.client = BrokenClient()
    with pytest.raises(LoginProtectionStoreUnavailable) as caught:
        store.ping()
    assert "secret" not in str(caught.value)


def test_retry_after_is_a_positive_integer() -> None:
    clock = FakeClock()
    _, first, _ = shared_stores(clock)
    limited = policy(ip_threshold=1)
    first.check_and_record_attempt("u1", "ip", "1", limited)
    result = first.check_and_record_attempt("u2", "ip", "2", limited)
    assert isinstance(result.retry_after_seconds, int)
    assert result.retry_after_seconds > 0

def test_redis_timeout_becomes_controlled_store_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    from redis.exceptions import TimeoutError as RedisTimeoutError

    client = fakeredis.FakeRedis(decode_responses=True)
    store = RedisLoginProtectionStore(client, "test:login")

    def time_out(**kwargs: object) -> object:
        raise RedisTimeoutError("timed out")

    monkeypatch.setattr(store, "_check_script", time_out)
    with pytest.raises(LoginProtectionStoreUnavailable):
        store.check_and_record_attempt("u", "ip", "member", policy())


def test_ip_threshold_allows_fifteen_and_blocks_sixteenth() -> None:
    _, first, second = shared_stores(FakeClock())
    default_policy = policy(ip_threshold=15)
    for index in range(15):
        store = first if index % 2 == 0 else second
        assert store.check_and_record_attempt(f"user-{index}", "shared-ip", str(index), default_policy).allowed
    blocked = first.check_and_record_attempt("user-16", "shared-ip", "16", default_policy)
    assert not blocked.allowed
    assert blocked.block_reason == "ip_rate_limit"


def test_lua_response_error_becomes_controlled_store_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    from redis.exceptions import ResponseError

    store = RedisLoginProtectionStore(fakeredis.FakeRedis(), "test:login")

    def lua_error(**kwargs: object) -> object:
        raise ResponseError("script failed")

    monkeypatch.setattr(store, "_check_script", lua_error)
    with pytest.raises(LoginProtectionStoreUnavailable):
        store.check_and_record_attempt("u", "ip", "member", policy())


def test_programming_error_is_not_misclassified_as_redis_outage(monkeypatch: pytest.MonkeyPatch) -> None:
    store = RedisLoginProtectionStore(fakeredis.FakeRedis(), "test:login")

    def programming_bug(**kwargs: object) -> object:
        raise AttributeError("programming bug")

    monkeypatch.setattr(store, "_check_script", programming_bug)
    with pytest.raises(AttributeError, match="programming bug"):
        store.check_and_record_attempt("u", "ip", "member", policy())


def test_redis_factory_applies_pool_limit_and_timeouts() -> None:
    config = service_config(
        login_protection_store="redis",
        redis_url="redis://localhost:6379/0",
        redis_socket_timeout_seconds=1.5,
        redis_connect_timeout_seconds=1.25,
        redis_max_connections=7,
    )
    store = RedisLoginProtectionStore.from_settings(config)
    kwargs = store.client.connection_pool.connection_kwargs
    assert store.client.connection_pool.max_connections == 7
    assert kwargs["socket_timeout"] == 1.5
    assert kwargs["socket_connect_timeout"] == 1.25
    store.close()

def test_registration_attempts_are_shared_between_redis_store_instances() -> None:
    _, first, second = shared_stores(FakeClock())
    limited = registration_policy(email_threshold=2, ip_threshold=100)

    assert first.check_and_record_registration("email-hash", "ip-hash", "1", limited).allowed
    assert second.check_and_record_registration("email-hash", "ip-hash", "2", limited).allowed
    blocked = first.check_and_record_registration("email-hash", "ip-hash", "3", limited)

    assert not blocked.allowed
    assert blocked.block_reason == "registration_email_rate_limit"
    assert blocked.retry_after_seconds == 1800


def test_registration_ip_limit_is_shared_between_redis_store_instances() -> None:
    _, first, second = shared_stores(FakeClock())
    limited = registration_policy(email_threshold=100, ip_threshold=2)

    assert first.check_and_record_registration("email-1", "ip-hash", "1", limited).allowed
    assert second.check_and_record_registration("email-2", "ip-hash", "2", limited).allowed
    blocked = first.check_and_record_registration("email-3", "ip-hash", "3", limited)

    assert not blocked.allowed
    assert blocked.block_reason == "registration_ip_rate_limit"
    assert blocked.retry_after_seconds == 3600


def test_registration_redis_keys_use_hashes_and_ttl() -> None:
    client, first, _ = shared_stores(FakeClock())
    email = "Farmer@example.com"
    email_hash = hash_identifier(normalize_username(email))
    ip_hash = hash_identifier("198.51.100.10")

    first.check_and_record_registration(email_hash, ip_hash, "attempt", registration_policy())

    keys = [str(key) for key in client.scan_iter(match="test:login:registration:*")]
    assert len(keys) == 2
    assert all(client.pttl(key) > 0 for key in keys)
    assert email.lower() not in " ".join(keys).lower()


def test_registration_store_outage_is_controlled_and_fail_closed(caplog: pytest.LogCaptureFixture) -> None:
    server = fakeredis.FakeServer()
    server.connected = False
    store = RedisLoginProtectionStore(fakeredis.FakeRedis(server=server), "test:login")
    service = LoginProtectionService(store=store, config=service_config())

    with caplog.at_level("ERROR", logger="agrimonitor.security"), pytest.raises(HTTPException) as caught:
        service.before_registration("farmer@example.com", request_for())

    assert caught.value.status_code == 503
    assert "Redis" not in str(caught.value.detail)
    assert any(
        record.__dict__.get("event") == "registration_failed"
        and record.__dict__.get("failure_reason") == "protection_store_unavailable"
        for record in caplog.records
    )


def test_memory_reset_clears_registration_state() -> None:
    store = InMemoryLoginProtectionStore(clock=lambda: 1000.0)
    store.check_and_record_registration("email", "ip", "attempt", registration_policy())
    store.reset()
    assert not store.registration_email_attempts
    assert not store.registration_ip_attempts
