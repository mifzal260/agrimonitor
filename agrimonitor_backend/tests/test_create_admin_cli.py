import logging

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.cli import create_admin
from app.models.user import User


def configure_cli_inputs(monkeypatch: pytest.MonkeyPatch, db: Session, password: str = "password123") -> None:
    answers = iter(["CLI Admin", "cli-admin@example.com"])
    passwords = iter([password, password])
    monkeypatch.setattr("builtins.input", lambda prompt: next(answers))
    monkeypatch.setattr(create_admin.getpass, "getpass", lambda prompt: next(passwords))
    monkeypatch.setattr(create_admin.getpass, "getuser", lambda: "pytest-operator")
    monkeypatch.setattr(create_admin, "SessionLocal", lambda: db)


def test_cli_creates_admin_without_displaying_password(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    caplog: pytest.LogCaptureFixture,
) -> None:
    configure_cli_inputs(monkeypatch, db_session)

    with caplog.at_level(logging.INFO, logger="agrimonitor.security"):
        result = create_admin.main()

    output = capsys.readouterr().out
    admin = db_session.scalar(select(User).where(User.email == "cli-admin@example.com"))
    assert result == 0
    assert admin is not None
    assert admin.role == "admin"
    assert "password123" not in output
    assert "cli-admin@example.com" not in output
    assert any(record.__dict__.get("event") == "admin_provisioning_success" for record in caplog.records)


def test_cli_duplicate_email_fails_without_changing_existing_admin(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    configure_cli_inputs(monkeypatch, db_session)
    assert create_admin.main() == 0
    capsys.readouterr()

    configure_cli_inputs(monkeypatch, db_session)
    assert create_admin.main() == 1
    output = capsys.readouterr().out

    assert "password123" not in output
    assert len(db_session.scalars(select(User).where(User.email == "cli-admin@example.com")).all()) == 1


def test_cli_rejects_password_mismatch_without_database_change(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    answers = iter(["CLI Admin", "cli-admin@example.com"])
    passwords = iter(["password123", "different-password"])
    monkeypatch.setattr("builtins.input", lambda prompt: next(answers))
    monkeypatch.setattr(create_admin.getpass, "getpass", lambda prompt: next(passwords))
    monkeypatch.setattr(create_admin, "SessionLocal", lambda: db_session)

    assert create_admin.main() == 1
    assert "password123" not in capsys.readouterr().out
    assert db_session.scalar(select(User)) is None


@pytest.mark.parametrize("password", ["", "é" * 37])
def test_cli_rejects_invalid_bcrypt_password_without_database_change(
    password: str,
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    configure_cli_inputs(monkeypatch, db_session, password=password)

    assert create_admin.main() == 1
    output = capsys.readouterr().out
    if password:
        assert password not in output
    assert db_session.scalar(select(User)) is None


def test_cli_database_failure_is_controlled_and_closes_session(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    class FailingSession:
        closed = False

        def close(self) -> None:
            self.closed = True

    db = FailingSession()
    answers = iter(["CLI Admin", "cli-admin@example.com"])
    passwords = iter(["password123", "password123"])
    monkeypatch.setattr("builtins.input", lambda prompt: next(answers))
    monkeypatch.setattr(create_admin.getpass, "getpass", lambda prompt: next(passwords))
    monkeypatch.setattr(create_admin.getpass, "getuser", lambda: "operator\nignored")
    monkeypatch.setattr(create_admin, "SessionLocal", lambda: db)
    monkeypatch.setattr(
        create_admin,
        "provision_admin",
        lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("database unavailable")),
    )

    assert create_admin.main() == 1
    output = capsys.readouterr().out
    assert "database unavailable" not in output
