import pytest

from app.db import database


class FakeSession:
    def __init__(self) -> None:
        self.rolled_back = False
        self.closed = False

    def rollback(self) -> None:
        self.rolled_back = True

    def close(self) -> None:
        self.closed = True


def test_get_db_rolls_back_and_closes_on_exception(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_session = FakeSession()
    monkeypatch.setattr(database, "SessionLocal", lambda: fake_session)

    db_generator = database.get_db()
    assert next(db_generator) is fake_session

    with pytest.raises(RuntimeError):
        db_generator.throw(RuntimeError("database write failed"))

    assert fake_session.rolled_back is True
    assert fake_session.closed is True
