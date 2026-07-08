import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.routers.tryon import _check_verified


def _user(verified: bool):
    return SimpleNamespace(
        id=uuid.uuid4(),
        email_verified_at=datetime.now(timezone.utc) if verified else None,
    )


def test_gate_blocks_unverified_with_machine_detail():
    with pytest.raises(HTTPException) as exc:
        _check_verified(_user(verified=False))
    assert exc.value.status_code == 403
    assert exc.value.detail == "email_unverified"


def test_gate_passes_verified():
    _check_verified(_user(verified=True))  # must not raise


def test_verify_routes_registered():
    from app.main import app

    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/auth/verify/request" in paths
    assert "/auth/verify" in paths


def test_user_me_schema_has_verified_flag():
    from app.schemas.auth import UserMe

    me = UserMe(id="x", email="a@b.co")
    assert me.email_verified is False


def test_legacy_ask_route_removed():
    from app.main import app

    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/stylist/ask" not in paths
