import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app.services import password_reset_service as prs
from app.services.password_reset_service import (
    ResetTokenError,
    _hash_token,
    request_reset,
    reset_password,
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


def test_hash_token_is_sha256_hex():
    h = _hash_token("abc")
    assert len(h) == 64 and h == _hash_token("abc") and h != _hash_token("abd")


async def test_request_reset_unknown_email_sends_nothing(monkeypatch):
    async def no_user(db, email):
        return None

    sent = []

    async def fake_send(to, subject, body):
        sent.append(to)

    monkeypatch.setattr(prs, "_get_user_by_email", no_user)
    monkeypatch.setattr(prs, "_invalidate_tokens", _noop_async())
    import app.services.email_service as email
    monkeypatch.setattr(email, "send_email", fake_send)

    await request_reset(FakeDB(), "ghost@example.com")
    assert sent == []


async def test_request_reset_emails_link_with_token(monkeypatch):
    user = SimpleNamespace(id=uuid.uuid4(), email="ayan@example.com")

    async def find_user(db, email):
        return user

    sent = {}

    async def fake_send(to, subject, body):
        sent["to"] = to
        sent["body"] = body

    monkeypatch.setattr(prs, "_get_user_by_email", find_user)
    monkeypatch.setattr(prs, "_invalidate_tokens", _noop_async())
    import app.services.email_service as email
    monkeypatch.setattr(email, "send_email", fake_send)

    db = FakeDB()
    await request_reset(db, "ayan@example.com")

    assert sent["to"] == "ayan@example.com"
    assert "/reset-password?token=" in sent["body"]
    # the raw token in the mail must hash to what we stored
    raw = sent["body"].split("token=")[1].split()[0]
    assert db.added and db.added[0].token_hash == _hash_token(raw)
    assert db.committed


async def test_request_reset_email_contains_pasteable_code(monkeypatch):
    user = SimpleNamespace(id=uuid.uuid4(), email="leyla@example.com")

    async def find_user(db, email):
        return user

    bodies = []

    async def fake_send(to, subject, body):
        bodies.append(body)

    monkeypatch.setattr(prs, "_get_user_by_email", find_user)
    monkeypatch.setattr(prs, "_invalidate_tokens", _noop_async())
    import app.services.email_service as email
    monkeypatch.setattr(email, "send_email", fake_send)

    db = FakeDB()
    await request_reset(db, "leyla@example.com")

    assert len(bodies) == 1
    assert "Reset code (paste it in the app):" in bodies[0]
    # the raw token appears both in the link and as the standalone code
    # we can't read the raw token back (only its hash is stored), so instead
    # assert the code line and the link line share the same trailing token
    code_line = next(l for l in bodies[0].splitlines() if l.startswith("Reset code"))
    link_line = next(l for l in bodies[0].splitlines() if "reset-password?token=" in l)
    assert code_line.rsplit(" ", 1)[-1] == link_line.rsplit("token=", 1)[-1]


async def test_reset_password_rejects_unknown_token(monkeypatch):
    async def no_row(db, token_hash):
        return None

    monkeypatch.setattr(prs, "_get_valid_token", no_row)
    with pytest.raises(ResetTokenError):
        await reset_password(FakeDB(), "bogus", "newpass123")


async def test_reset_password_rotates_hash_and_burns_token(monkeypatch):
    user = SimpleNamespace(id=uuid.uuid4(), hashed_password="old")
    row = SimpleNamespace(
        user_id=user.id,
        used_at=None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )

    async def get_row(db, token_hash):
        return row

    async def get_user(db, user_id):
        return user

    monkeypatch.setattr(prs, "_get_valid_token", get_row)
    monkeypatch.setattr(prs, "_get_user_by_id", get_user)

    db = FakeDB()
    await reset_password(db, "goodtoken", "newpass123")
    assert user.hashed_password != "old"
    assert row.used_at is not None
    assert db.committed
