import logging

import bcrypt
import pytest

from app.core.security import (
    BCRYPT_ROUNDS,
    DUMMY_PASSWORD_HASH,
    MAX_BCRYPT_PASSWORD_BYTES,
    PasswordTooLongError,
    hash_password,
    verify_password,
)

FIXTURE_PASSWORD = "compatibility-fixture-password"
LEGACY_2A_HASH = "$2a$12$crNzKOLpb.QdBqz2JohGr.QXKjrXYPD/swg3yVjswzdjSZHpb/Zv."
LEGACY_2B_HASH = "$2b$12$TTFoCf7Lg5fNy46MRbKwc.2Jwfpq6uzqIz8IQRO2K2LsuUgcH2kNi"
LEGACY_COST_10_HASH = "$2b$10$/.RzBwtTWqP0psLV0g61CeH3RO/RtQgoVTQogEPoBALrJdQIGV4/e"


@pytest.mark.parametrize("password_hash", [LEGACY_2A_HASH, LEGACY_2B_HASH])
def test_legacy_bcrypt_hashes_remain_compatible(password_hash: str) -> None:
    assert verify_password(FIXTURE_PASSWORD, password_hash) is True
    assert verify_password("wrong-fixture-password", password_hash) is False


def test_legacy_hash_cost_does_not_need_to_match_current_cost() -> None:
    assert verify_password("legacy-cost-password", LEGACY_COST_10_HASH) is True
    assert verify_password("wrong-legacy-cost-password", LEGACY_COST_10_HASH) is False


def test_hash_password_creates_verifiable_bcrypt_2b_hash() -> None:
    password_hash = hash_password(FIXTURE_PASSWORD)

    assert password_hash.startswith(f"$2b${BCRYPT_ROUNDS:02d}$")
    assert verify_password(FIXTURE_PASSWORD, password_hash) is True
    assert verify_password("wrong-fixture-password", password_hash) is False


def test_dummy_hash_executes_real_bcrypt_verification() -> None:
    result = verify_password("unknown-user-password", DUMMY_PASSWORD_HASH)

    assert isinstance(result, bool)
    assert (
        bcrypt.checkpw(
            b"unknown-user-password",
            DUMMY_PASSWORD_HASH.encode("ascii"),
        )
        is result
    )


def test_hash_password_rejects_more_than_72_utf8_bytes() -> None:
    with pytest.raises(PasswordTooLongError, match="72 UTF-8 bytes"):
        hash_password("a" * (MAX_BCRYPT_PASSWORD_BYTES + 1))


def test_hash_password_accepts_unicode_at_72_byte_boundary() -> None:
    password = "é" * (MAX_BCRYPT_PASSWORD_BYTES // 2)

    password_hash = hash_password(password)

    assert len(password.encode("utf-8")) == MAX_BCRYPT_PASSWORD_BYTES
    assert verify_password(password, password_hash) is True


def test_oversized_password_never_matches_legacy_truncated_value() -> None:
    password_at_limit = "a" * MAX_BCRYPT_PASSWORD_BYTES
    password_hash = hash_password(password_at_limit)

    assert verify_password(password_at_limit + "b", password_hash) is False
    assert verify_password(("é" * 36) + "é", hash_password("é" * 36)) is False


def test_password_with_null_byte_is_handled_consistently() -> None:
    password = "prefix\x00suffix"
    password_hash = hash_password(password)

    assert verify_password(password, password_hash) is True
    assert verify_password("prefix\x00wrong", password_hash) is False


def test_programming_type_error_is_not_swallowed(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core import security

    def programming_error(password: bytes, password_hash: bytes) -> bool:
        raise TypeError("programming bug")

    monkeypatch.setattr(security.bcrypt, "checkpw", programming_error)

    with pytest.raises(TypeError, match="programming bug"):
        verify_password(FIXTURE_PASSWORD, LEGACY_2B_HASH)


def test_malformed_or_non_ascii_hash_is_rejected() -> None:
    assert verify_password(FIXTURE_PASSWORD, "not-a-bcrypt-hash") is False
    assert verify_password(FIXTURE_PASSWORD, "é" * 60) is False


def test_password_operations_emit_no_passlib_bcrypt_warning(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING):
        password_hash = hash_password(FIXTURE_PASSWORD)
        assert verify_password(FIXTURE_PASSWORD, password_hash) is True

    log_text = "\n".join(record.getMessage() for record in caplog.records)
    assert FIXTURE_PASSWORD not in log_text
    assert password_hash not in log_text
    assert "error reading bcrypt version" not in log_text
    assert "bcrypt.__about__" not in log_text
    assert "passlib.handlers.bcrypt" not in {record.name for record in caplog.records}
