"""Render quota tracking — plan limits for try-on job creation."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job import TryOnJob

# Renders per calendar month (UTC). None = unlimited. Must match /pricing copy.
PLAN_RENDER_LIMITS: dict[str, int | None] = {"free": 5, "pro": 50, "premium": None}


class QuotaExceededError(RuntimeError):
    def __init__(self, plan: str, limit: int):
        super().__init__(
            f"You've used all {limit} try-on renders on the {plan} plan this month. "
            "Upgrade for more."
        )
        self.plan = plan
        self.limit = limit


def _month_start(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def get_plan(db: AsyncSession, user_id: uuid.UUID) -> str:
    import app.services.payment_service as payments

    sub = await payments.get_user_subscription(db, user_id)
    if sub is not None and sub.is_active:
        return sub.plan
    return "free"


async def count_renders_this_month(db: AsyncSession, user_id: uuid.UUID) -> int:
    since = _month_start(datetime.now(timezone.utc))
    res = await db.execute(
        select(func.count())
        .select_from(TryOnJob)
        .where(
            TryOnJob.user_id == user_id,
            TryOnJob.created_at >= since,
            TryOnJob.status != "failed",
        )
    )
    return int(res.scalar() or 0)


async def get_render_usage(db: AsyncSession, user_id: uuid.UUID) -> dict:
    plan = await get_plan(db, user_id)
    limit = PLAN_RENDER_LIMITS.get(plan, PLAN_RENDER_LIMITS["free"])
    used = await count_renders_this_month(db, user_id)
    remaining = None if limit is None else max(limit - used, 0)
    return {"plan": plan, "limit": limit, "used": used, "remaining": remaining}


async def _advisory_lock(db: AsyncSession, user_id: uuid.UUID) -> None:
    # Transaction-scoped: held until the caller's commit/rollback, so the
    # count check and the job INSERT that follows it are serialized per user.
    key = int.from_bytes(user_id.bytes[:8], "big", signed=True)
    await db.execute(select(func.pg_advisory_xact_lock(key)))


async def ensure_render_allowed(db: AsyncSession, user_id: uuid.UUID) -> None:
    await _advisory_lock(db, user_id)
    usage = await get_render_usage(db, user_id)
    if usage["limit"] is not None and usage["used"] >= usage["limit"]:
        raise QuotaExceededError(usage["plan"], usage["limit"])
