# Render Quotas & Plan Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the pricing page true — track try-on render usage per calendar month and enforce Free (5), Pro (50), Premium (unlimited) limits, with a usage API and a settings meter, so free users stop consuming unlimited paid FAL renders.

**Architecture:** A small `quota_service` derives the user's plan from the existing `Subscription` row (no subscription → "free"), counts this month's `TryOnJob` rows (all statuses except `failed` — a render that reached FAL costs money even if slow), and raises `QuotaExceededError` when at limit. The three `/tryon/*` job-creating endpoints call it before any work and map the error to HTTP 402. `GET /billing/usage` exposes `{plan, limit, used, remaining}`; the settings Subscription card renders a meter from it. No new tables — `tryon_jobs.created_at` is the ledger.

**Tech Stack:** FastAPI, SQLAlchemy async, pytest + pytest-asyncio (existing harness in `backend/tests/`), Next.js 15.

## Global Constraints

- Plan limits (renders per calendar month, UTC): `free: 5`, `pro: 50`, `premium: None` (unlimited). Must match the pricing page copy.
- Quota check runs BEFORE avatar lookup and file processing in every job-creating endpoint — a blocked user must never trigger storage writes or FAL calls.
- Over-limit response is HTTP **402** with detail `"You've used all {limit} try-on renders on the {plan} plan this month. Upgrade for more."` — the frontend `request()` helper already surfaces `detail` as the thrown `Error` message.
- Jobs with `status == "failed"` do NOT count against quota (user got nothing).
- Existing endpoints' success behavior is unchanged for under-limit users.
- Backend tests run from `backend/`: `python -m pytest tests -v`. Frontend must pass `cd frontend && npx tsc --noEmit`.
- Python style: 4-space indent; import order stdlib → blank line → `app.` imports; module-object imports for monkeypatch-ability (`import app.services.x as x`).

---

### Task 1: quota_service — plan resolution, usage counting, enforcement

**Files:**
- Create: `backend/app/services/quota_service.py`
- Test: `backend/tests/test_quota_service.py`

**Interfaces:**
- Consumes: `app.services.payment_service.get_user_subscription(db, user_id) -> Subscription | None` (existing), `TryOnJob` model.
- Produces (used by Tasks 2–3):
  - `PLAN_RENDER_LIMITS: dict[str, int | None]`
  - `class QuotaExceededError(RuntimeError)` with attributes `plan: str`, `limit: int`
  - `async get_plan(db, user_id) -> str` — `"free"` unless an active subscription exists, then `sub.plan`
  - `async count_renders_this_month(db, user_id) -> int`
  - `async get_render_usage(db, user_id) -> dict` — keys `plan: str`, `limit: int | None`, `used: int`, `remaining: int | None`
  - `async ensure_render_allowed(db, user_id) -> None` — raises `QuotaExceededError` at/over limit
  - `_month_start(now: datetime) -> datetime` — pure helper, first instant of `now`'s month in UTC

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_quota_service.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_quota_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.quota_service'`

- [ ] **Step 3: Implement the service**

`backend/app/services/quota_service.py`:

```python
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


async def ensure_render_allowed(db: AsyncSession, user_id: uuid.UUID) -> None:
    usage = await get_render_usage(db, user_id)
    if usage["limit"] is not None and usage["used"] >= usage["limit"]:
        raise QuotaExceededError(usage["plan"], usage["limit"])
```

Note: `get_render_usage` calls the module-global `count_renders_this_month`, so the tests' `monkeypatch.setattr(quota_service, "count_renders_this_month", ...)` takes effect.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_quota_service.py -v`
Expected: 10 PASSED.

- [ ] **Step 5: Run the full suite and commit**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -v`
Expected: all PASSED (30 existing + 10 new).

```bash
git add backend/app/services/quota_service.py backend/tests/test_quota_service.py
git commit -m "feat(billing): quota service — plan limits and monthly render counting"
```

---

### Task 2: Enforce quota in the three /tryon job-creating endpoints

**Files:**
- Modify: `backend/app/routers/tryon.py` (imports at top; first line of `tryon_url` ~line 68, `tryon_upload` ~line 94, `tryon_outfit` ~line 130)

**Interfaces:**
- Consumes: `ensure_render_allowed`, `QuotaExceededError` from Task 1.
- Produces: HTTP 402 with the QuotaExceededError message as `detail` on all three endpoints; a `_check_quota` helper local to the router.

- [ ] **Step 1: Add imports and helper**

In `backend/app/routers/tryon.py`, extend the service imports (after the `from app.services.tryon_service import ...` line):

```python
from app.services.quota_service import QuotaExceededError, ensure_render_allowed
```

Add after the `_get_avatar` helper:

```python
async def _check_quota(db: AsyncSession, user_id: uuid.UUID) -> None:
    try:
        await ensure_render_allowed(db, user_id)
    except QuotaExceededError as e:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, str(e)) from e
```

- [ ] **Step 2: Call it first in each endpoint**

In `tryon_url`, `tryon_upload`, and `tryon_outfit`, insert as the FIRST line of the function body (before `_get_avatar` / content-type checks):

```python
    await _check_quota(db, user.id)
```

- [ ] **Step 3: Verify app imports and suite passes**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -c "from app.main import app; print('ok')" && python -m pytest tests -q`
Expected: `ok`, all PASSED.

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/tryon.py
git commit -m "feat(tryon): enforce monthly render quota with 402 before any work"
```

---

### Task 3: GET /billing/usage endpoint

**Files:**
- Modify: `backend/app/schemas/subscription.py` (append)
- Modify: `backend/app/routers/billing.py` (append endpoint, extend imports)

**Interfaces:**
- Consumes: `get_render_usage` (Task 1).
- Produces: `GET /billing/usage` → `RenderUsage {plan: str, limit: int | None, used: int, remaining: int | None}`. Task 4's frontend calls this.

- [ ] **Step 1: Add the schema**

Append to `backend/app/schemas/subscription.py`:

```python
class RenderUsage(BaseModel):
    plan: str
    limit: int | None = None
    used: int
    remaining: int | None = None
```

- [ ] **Step 2: Add the endpoint**

In `backend/app/routers/billing.py`: extend the schemas import with `RenderUsage`, add `from app.services.quota_service import get_render_usage` to the imports, and append:

```python
@router.get("/usage", response_model=RenderUsage)
async def render_usage(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    return RenderUsage(**await get_render_usage(db, user.id))
```

- [ ] **Step 3: Verify route registration and suite**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -c "from app.main import app; assert any(getattr(r, 'path', '') == '/billing/usage' for r in app.routes); print('route ok')" && python -m pytest tests -q`
Expected: `route ok`, all PASSED.

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/subscription.py backend/app/routers/billing.py
git commit -m "feat(billing): GET /billing/usage render quota endpoint"
```

---

### Task 4: Frontend — usage meter in Settings subscription card

**Files:**
- Modify: `frontend/src/lib/api.ts` (type near `SubscriptionStatus`; method after `billingSubscription()` at ~line 419)
- Modify: `frontend/src/app/settings/page.tsx` (`SubscriptionSection` at ~line 73)

**Interfaces:**
- Consumes: `GET /billing/usage` (Task 3).
- Produces: `api.renderUsage()`, `RenderUsage` type, a usage meter row inside the existing subscription card.

- [ ] **Step 1: Add API type and method**

In `frontend/src/lib/api.ts`, add next to the other exported types:

```typescript
export type RenderUsage = {
  plan: string;
  limit: number | null;
  used: number;
  remaining: number | null;
};
```

Add to the `api` object directly after the `billingSubscription()` method:

```typescript
  renderUsage() {
    return request<RenderUsage>("/billing/usage");
  },
```

- [ ] **Step 2: Render the meter in SubscriptionSection**

In `frontend/src/app/settings/page.tsx`, inside `SubscriptionSection`, add state + fetch at the top of the component:

```typescript
  const [usage, setUsage] = useState<RenderUsage | null>(null);
  useEffect(() => {
    api.renderUsage().then(setUsage).catch(() => {});
  }, []);
```

Extend the settings page's api import with `type RenderUsage`. Then render, at the bottom of the card's JSX (inside the outermost card div, after the existing plan/status content):

```tsx
      {usage && (
        <div className="pt-3 border-t border-line/60 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted font-medium">Try-on renders this month</span>
            <span className="font-bold text-ink">
              {usage.limit === null ? `${usage.used} / ∞` : `${usage.used} / ${usage.limit}`}
            </span>
          </div>
          {usage.limit !== null && (
            <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
              <div
                className="h-full rounded-full bg-coral transition-all"
                style={{ width: `${Math.min((usage.used / usage.limit) * 100, 100)}%` }}
              />
            </div>
          )}
          {usage.remaining === 0 && (
            <Link href="/pricing" className="text-xs font-bold text-coral hover:text-ink transition-colors">
              Out of renders — upgrade →
            </Link>
          )}
        </div>
      )}
```

(`Link`, `useState`, `useEffect` are already imported in this file.)

- [ ] **Step 3: Typecheck**

Run: `cd C:/Users/Envy/Desktop/VTO/frontend && npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/app/settings/page.tsx
git commit -m "feat(settings): render usage meter with upgrade CTA"
```

---

### Task 5: Live verification (docker stack)

**Files:** none — verification only; fixes get their own commits.

- [ ] **Step 1: Restart backend so new code loads**

Run: `cd C:/Users/Envy/Desktop/VTO && docker compose up -d db backend && sleep 8 && docker logs vto-backend-1 --tail 3`
Expected: "Application startup complete", no tracebacks. (Backend bind-mounts `./backend`, uvicorn `--reload` picks changes automatically; the restart is belt-and-braces.)

- [ ] **Step 2: Seed a free user at the limit**

Register `quota-test@example.com` / `Test12345!` via `POST /auth/register`, then insert a fake avatar + 5 non-failed jobs:

```sql
-- docker exec vto-db-1 psql -U fitme -d fitme
INSERT INTO avatars (id, user_id, photo_key, created_at)
SELECT gen_random_uuid(), id, 'seed/avatar.jpg', now() FROM users WHERE email='quota-test@example.com';

INSERT INTO tryon_jobs (id, user_id, avatar_id, category, status, created_at)
SELECT gen_random_uuid(), u.id, a.id, 'tops', 'completed', now()
FROM users u JOIN avatars a ON a.user_id = u.id, generate_series(1, 5)
WHERE u.email='quota-test@example.com';
```

(If `avatars` has NOT NULL columns beyond these, inspect with `\d avatars` and fill accordingly.)

- [ ] **Step 3: Verify 402 + usage endpoint**

With the user's token:
- `GET /billing/usage` → `{"plan": "free", "limit": 5, "used": 5, "remaining": 0}`
- `POST /tryon/url` with `{"garment_url": "https://example.com/x.jpg"}` → **402**, detail contains "used all 5".
- Mark one job failed (`UPDATE tryon_jobs SET status='failed' WHERE ...LIMIT via ctid or id`), re-check usage → `used: 4`, and `POST /tryon/url` now passes quota (may fail later on the fake avatar — anything other than 402 proves the gate ordering).

- [ ] **Step 4: Settings meter spot-check**

`cd frontend && npm run dev` (or docker frontend), log in as the seeded user, open `/settings` → subscription card shows "5 / 5" meter and "Out of renders — upgrade →" link.

- [ ] **Step 5: Clean up and commit fixes if any**

```sql
DELETE FROM users WHERE email='quota-test@example.com';
```

```bash
git add -A backend/app frontend/src
git commit -m "fix(billing): quota follow-ups from live verification"
```

(Skip commit if nothing changed.)

---

## Self-Review Notes

- **Coverage:** COGS leak closed (Task 2 gates before storage/FAL work), pricing honesty (limits constant tested against copy in Task 1), paid differentiation visible (Task 4 meter), API for any client (Task 3).
- **Deliberate cuts:** no proration/mid-month plan-change handling (usage is plan-agnostic counting; limit snaps to current plan — acceptable); no quota on stylist chat (Gemini is cheap relative to FAL; revisit under quota pressure); outfit renders in `/outfits` router (if any render path exists there) intentionally out of scope — only `tryon_jobs` rows cost FAL money today.
- **Type consistency:** `get_render_usage` dict keys = `RenderUsage` schema fields = frontend `RenderUsage` type; `QuotaExceededError(plan, limit)` attributes used in router mapping and tests.
