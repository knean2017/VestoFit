import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.services import quota_service
from app.services.quota_service import (
    PLAN_RENDER_LIMITS,
    QuotaExceededError,
    _month_start,
    ensure_render_allowed,
    get_plan,
    get_render_usage,
)

USER_ID = uuid.uuid4()


def test_month_start_is_first_instant_utc():
    now = datetime(2026, 7, 4, 15, 30, 12, tzinfo=timezone.utc)
    start = _month_start(now)
    assert start == datetime(2026, 7, 1, tzinfo=timezone.utc)


def test_plan_limits_match_pricing_page():
    assert PLAN_RENDER_LIMITS == {"free": 5, "pro": 50, "premium": None}


@pytest.fixture
def no_subscription(monkeypatch):
    async def fake_sub(db, user_id):
        return None

    import app.services.payment_service as payments
    monkeypatch.setattr(payments, "get_user_subscription", fake_sub)


@pytest.fixture
def pro_subscription(monkeypatch):
    async def fake_sub(db, user_id):
        return SimpleNamespace(is_active=True, plan="pro")

    import app.services.payment_service as payments
    monkeypatch.setattr(payments, "get_user_subscription", fake_sub)


def used(n):
    async def fake_count(db, user_id):
        return n
    return fake_count


async def test_get_plan_defaults_to_free(no_subscription):
    assert await get_plan(None, USER_ID) == "free"


async def test_get_plan_reads_active_subscription(pro_subscription):
    assert await get_plan(None, USER_ID) == "pro"


async def test_inactive_subscription_is_free(monkeypatch):
    async def fake_sub(db, user_id):
        return SimpleNamespace(is_active=False, plan="pro")

    import app.services.payment_service as payments
    monkeypatch.setattr(payments, "get_user_subscription", fake_sub)
    assert await get_plan(None, USER_ID) == "free"


async def test_usage_free_plan(no_subscription, monkeypatch):
    monkeypatch.setattr(quota_service, "count_renders_this_month", used(3))
    usage = await get_render_usage(None, USER_ID)
    assert usage == {"plan": "free", "limit": 5, "used": 3, "remaining": 2}


async def test_usage_premium_is_unlimited(monkeypatch):
    async def fake_sub(db, user_id):
        return SimpleNamespace(is_active=True, plan="premium")

    import app.services.payment_service as payments
    monkeypatch.setattr(payments, "get_user_subscription", fake_sub)
    monkeypatch.setattr(quota_service, "count_renders_this_month", used(999))
    usage = await get_render_usage(None, USER_ID)
    assert usage["limit"] is None and usage["remaining"] is None


async def test_ensure_allows_under_limit(no_subscription, monkeypatch):
    monkeypatch.setattr(quota_service, "count_renders_this_month", used(4))
    await ensure_render_allowed(None, USER_ID)  # must not raise


async def test_ensure_blocks_at_limit(no_subscription, monkeypatch):
    monkeypatch.setattr(quota_service, "count_renders_this_month", used(5))
    with pytest.raises(QuotaExceededError) as exc:
        await ensure_render_allowed(None, USER_ID)
    assert exc.value.plan == "free"
    assert exc.value.limit == 5


async def test_unknown_plan_treated_as_free(monkeypatch):
    async def fake_sub(db, user_id):
        return SimpleNamespace(is_active=True, plan="enterprise")

    import app.services.payment_service as payments
    monkeypatch.setattr(payments, "get_user_subscription", fake_sub)
    monkeypatch.setattr(quota_service, "count_renders_this_month", used(5))
    with pytest.raises(QuotaExceededError):
        await ensure_render_allowed(None, USER_ID)
