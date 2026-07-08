import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.services import email_verification_service as evs
from app.services.email_verification_service import (
    VerificationCodeError,
    _hash_code,
    request_verification,
    verify_email,
)


class FakeDB:
    def __init__(self):
        self.added = []
        self.committed = False

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed = True


def _noop_async():
    async def f(*a, **k):
        return None
    return f


def _user(verified=False):
    return SimpleNamespace(
        id=uuid.uuid4(),
        email="leyla@example.com",
        email_verified_at=datetime.now(timezone.utc) if verified else None,
    )


async def test_request_sends_six_digit_code_line(monkeypatch):
    sent = {}

    async def fake_send(to, subject, body):
        sent["to"] = to
        sent["body"] = body

    monkeypatch.setattr(evs, "_invalidate_codes", _noop_async())
    import app.services.email_service as email
    monkeypatch.setattr(email, "send_email", fake_send)

    db = FakeDB()
    user = _user()
    await request_verification(db, user)

    assert sent["to"] == "leyla@example.com"
    line = next(
        l for l in sent["body"].splitlines()
        if l.startswith("Verification code (paste it in the app): ")
    )
    code = line.rsplit(" ", 1)[-1]
    assert len(code) == 6 and code.isdigit()
    assert db.added and db.added[0].code_hash == _hash_code(code)
    assert db.committed


async def test_request_noop_when_already_verified(monkeypatch):
    sent = []

    async def fake_send(to, subject, body):
        sent.append(to)

    monkeypatch.setattr(evs, "_invalidate_codes", _noop_async())
    import app.services.email_service as email
    monkeypatch.setattr(email, "send_email", fake_send)

    await request_verification(FakeDB(), _user(verified=True))
    assert sent == []


async def test_verify_sets_timestamp_and_burns_code(monkeypatch):
    user = _user()
    row = SimpleNamespace(
        user_id=user.id,
        used_at=None,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )

    async def get_row(db, user_id, code_hash):
        return row

    monkeypatch.setattr(evs, "_get_valid_code", get_row)

    db = FakeDB()
    await verify_email(db, user, "123456")
    assert user.email_verified_at is not None
    assert row.used_at is not None
    assert db.committed


async def test_verify_rejects_unknown_code(monkeypatch):
    async def no_row(db, user_id, code_hash):
        return None

    monkeypatch.setattr(evs, "_get_valid_code", no_row)
    with pytest.raises(VerificationCodeError):
        await verify_email(FakeDB(), _user(), "000000")
