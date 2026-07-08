# Email Verification + Stylist Cleanup + Grounded Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop free-render farming (email verification soft-gates the three FAL render endpoints), retire the dead `POST /stylist/ask` endpoint, and shield the capped Gemini quota with a TTL cache on grounded product search.

**Architecture:** Verification mirrors the proven password-reset stack: hashed single-use token table + service + two auth'd endpoints, with a 6-digit paste-able code emailed at signup. The gate is one helper in the tryon router returning 403 `email_unverified`, which mobile matches on to route the user to a new verify-email screen. The cache is a module-level dict in `shopping_service` wrapping `_search_grounded` only (the sole Gemini shopping path).

**Tech Stack:** FastAPI + SQLAlchemy async + pytest (backend); Expo SDK 54 / expo-router typed routes / react-native-unistyles / TanStack Query / RNTL v14 (mobile). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-06-verification-cleanup-caching-design.md`

## Global Constraints

- Mobile (`mobile/`) is the only production surface; web (`frontend/`) is dev-only — the only web change in this plan is deleting `stylistAsk` from its api client.
- No new npm or pip dependencies.
- Backend tests: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -q` — 58 pass before this plan; must stay green, each backend task adds more.
- Mobile checks from `C:/Users/Envy/Desktop/VTO/mobile`: `npm run typecheck` (clean), `npm run lint` (0 errors; 18 pre-existing warnings OK), `npx jest --ci` (31 pass before this plan).
- **RNTL v14:** `render` and `fireEvent` are async — always `await render(...)` and `await fireEvent.press(...)` in mobile tests.
- **Typed routes:** after creating a new file under `mobile/app/`, run `npx expo start --offline --port 8090` in background, wait until the route appears in `mobile/.expo/types/router.d.ts`, then kill the PID on port 8090 (`netstat -ano | grep :8090` → `taskkill //F //PID <pid>`).
- Verification email line (exact): `Verification code (paste it in the app): {code}` — 6-digit numeric code, 24 h TTL, single active code per user.
- Render-gate rejection (exact): HTTP 403 with `detail="email_unverified"` — mobile string-matches this.
- Mobile UI uses unistyles theme tokens; no hardcoded colors except `#fff` on accent backgrounds.
- Commit after every task; end commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Verification token model, migration, and service

**Files:**
- Create: `backend/app/models/email_verification.py`
- Modify: `backend/app/models/__init__.py` (register model)
- Modify: `backend/app/db_migrate.py` (add `users.email_verified_at`)
- Create: `backend/app/services/email_verification_service.py`
- Test: `backend/tests/test_email_verification_service.py` (create)

**Interfaces:**
- Consumes: `app.services.email_service.send_email(to, subject, body)`; `User` model; `Base` from `app.database`.
- Produces: `EmailVerificationToken` model (table `email_verification_tokens`); `VerificationCodeError(RuntimeError)`; `async request_verification(db, user: User) -> None`; `async verify_email(db, user: User, code: str) -> None`; `_hash_code(raw: str) -> str` (sha256 hex, test-visible). Task 2 imports the service functions; `users.email_verified_at` column exists after migration.

- [x] **Step 1: Write the failing tests**

Create `backend/tests/test_email_verification_service.py` (FakeDB/monkeypatch pattern copied from `test_password_reset_service.py`):

```python
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
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_email_verification_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.email_verification_service'`.

- [x] **Step 3: Model + registration + migration**

Create `backend/app/models/email_verification.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

(No unique constraint on `code_hash` — 6-digit codes collide across users; lookups are scoped by `user_id`.)

In `backend/app/models/__init__.py`, add after the `password_reset` import:

```python
from app.models.email_verification import EmailVerificationToken
```

and add `"EmailVerificationToken",` to `__all__`.

In `backend/app/models/user.py`, add after the `lng` column (import `datetime` is already present):

```python
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

(`DateTime` is already imported in `user.py`; if not, add it to the existing `sqlalchemy` import line.)

Append to `backend/app/db_migrate.py`, at the end of `run_migrations`:

```python
    await conn.execute(
        text(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = 'email_verified_at'
                ) THEN
                    ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
                END IF;
            END $$;
            """
        )
    )
```

- [x] **Step 4: Service**

Create `backend/app/services/email_verification_service.py`:

```python
"""Email verification — single-use, hashed, 24-hour 6-digit codes."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_verification import EmailVerificationToken
from app.models.user import User

_CODE_TTL = timedelta(hours=24)


class VerificationCodeError(RuntimeError):
    pass


def _hash_code(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def _invalidate_codes(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == user_id,
            EmailVerificationToken.used_at.is_(None),
        )
        .values(used_at=datetime.now(timezone.utc))
    )


async def _get_valid_code(
    db: AsyncSession, user_id: uuid.UUID, code_hash: str
) -> EmailVerificationToken | None:
    res = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user_id,
            EmailVerificationToken.code_hash == code_hash,
            EmailVerificationToken.used_at.is_(None),
            EmailVerificationToken.expires_at > datetime.now(timezone.utc),
        )
    )
    return res.scalar_one_or_none()


async def request_verification(db: AsyncSession, user: User) -> None:
    import app.services.email_service as email_svc

    if user.email_verified_at is not None:
        return

    await _invalidate_codes(db, user.id)
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            code_hash=_hash_code(code),
            expires_at=datetime.now(timezone.utc) + _CODE_TTL,
        )
    )
    await db.commit()

    await email_svc.send_email(
        user.email,
        "Verify your FitMe email",
        "Welcome to FitMe! Confirm this email address to unlock try-on renders.\n\n"
        f"Verification code (paste it in the app): {code}\n\n"
        "The code is valid for 24 hours. If you didn't sign up, ignore this email.",
    )


async def verify_email(db: AsyncSession, user: User, code: str) -> None:
    row = await _get_valid_code(db, user.id, _hash_code(code))
    if row is None:
        raise VerificationCodeError("This code is invalid or has expired")

    user.email_verified_at = datetime.now(timezone.utc)
    row.used_at = datetime.now(timezone.utc)
    await db.commit()
```

- [x] **Step 5: Run the new tests**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_email_verification_service.py -v`
Expected: 4 PASSED.

- [x] **Step 6: Full suite + commit**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -q`
Expected: 62 passed.

```bash
cd C:/Users/Envy/Desktop/VTO
git add backend/app/models/email_verification.py backend/app/models/__init__.py \
        backend/app/models/user.py backend/app/db_migrate.py \
        backend/app/services/email_verification_service.py \
        backend/tests/test_email_verification_service.py
git commit -m "feat(auth): email verification tokens — model, migration, service

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Verification endpoints, /me flag, and render gate

**Files:**
- Modify: `backend/app/schemas/auth.py` (add `VerifyEmailRequest`, extend `UserMe`)
- Modify: `backend/app/routers/auth.py` (two endpoints, register hook, `/me` flag)
- Modify: `backend/app/routers/tryon.py` (gate helper + three call sites)
- Test: `backend/tests/test_email_verification_api.py` (create)

**Interfaces:**
- Consumes: Task 1's `request_verification`, `verify_email`, `VerificationCodeError`; existing `rate_limit_auth`, `get_current_user`.
- Produces: `POST /auth/verify/request` → 202 `{message}`; `POST /auth/verify {code}` → 200 `{message}` / 400; `UserMe.email_verified: bool`; `_check_verified(user)` in tryon router raising 403 `detail="email_unverified"`. Task 5 (mobile) consumes all of these.

- [x] **Step 1: Write the failing tests**

Create `backend/tests/test_email_verification_api.py`:

```python
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
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_email_verification_api.py -v`
Expected: FAIL — `ImportError: cannot import name '_check_verified'`.

- [x] **Step 3: Schemas**

In `backend/app/schemas/auth.py`, add `email_verified: bool = False` to `UserMe` (after `lng`), and append at the end of the file:

```python
class VerifyEmailRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
```

- [x] **Step 4: Auth router**

In `backend/app/routers/auth.py`:

1. Extend the schema import block with `VerifyEmailRequest` and add:

```python
import logging

from app.services.email_verification_service import (
    VerificationCodeError,
    request_verification,
    verify_email,
)

_log = logging.getLogger("fitme.auth")
```

2. In `register`, after `await db.refresh(user)` and before the `return`:

```python
    try:
        await request_verification(db, user)
    except Exception:  # registration must never fail because email did
        _log.warning("verification email failed for %s", user.email, exc_info=True)
```

3. Add the two endpoints (after `do_reset_password`):

```python
@router.post(
    "/verify/request",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(rate_limit_auth)],
)
async def verify_request(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    await request_verification(db, user)
    return MessageResponse(message="Verification code sent — check your inbox.")


@router.post(
    "/verify",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit_auth)],
)
async def do_verify_email(
    payload: VerifyEmailRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    try:
        await verify_email(db, user, payload.code)
    except VerificationCodeError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return MessageResponse(message="Email verified — renders unlocked.")
```

4. In both `me` and `update_me`, add to the `UserMe(...)` constructor calls:

```python
        email_verified=user.email_verified_at is not None,
```

- [x] **Step 5: Render gate**

In `backend/app/routers/tryon.py`, add after `_check_quota`:

```python
def _check_verified(user: User) -> None:
    if user.email_verified_at is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "email_unverified")
```

In each of `tryon_url`, `tryon_upload`, `tryon_outfit`, insert `_check_verified(user)` on the line directly before the existing `await _check_quota(db, user.id)`.

- [x] **Step 6: Run tests, full suite, commit**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_email_verification_api.py -v`
Expected: 4 PASSED.
Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -q`
Expected: 66 passed.

```bash
cd C:/Users/Envy/Desktop/VTO
git add backend/app/schemas/auth.py backend/app/routers/auth.py \
        backend/app/routers/tryon.py backend/tests/test_email_verification_api.py
git commit -m "feat(auth): verify endpoints + render soft-gate for unverified emails

Signup auto-sends a 6-digit code; /tryon/* returns 403 email_unverified
until POST /auth/verify succeeds. Chat/wardrobe/shop stay open.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Grounded-search TTL cache

**Files:**
- Modify: `backend/app/services/shopping_service.py`
- Test: `backend/tests/test_grounded_cache.py` (create)

**Interfaces:**
- Consumes: existing `_search_grounded(query, budget_max, category, country, city)` (renamed to `_search_grounded_uncached`).
- Produces: `_search_grounded` same signature, now cache-wrapped; module constants `_GROUNDED_TTL = 12 * 3600`, `_GROUNDED_CACHE_MAX = 200`; dict `_GROUNDED_CACHE`. Nothing outside the module changes.

- [x] **Step 1: Write the failing tests**

Create `backend/tests/test_grounded_cache.py`:

```python
import pytest

import app.services.shopping_service as shop


@pytest.fixture(autouse=True)
def clean_cache():
    shop._GROUNDED_CACHE.clear()
    yield
    shop._GROUNDED_CACHE.clear()


def _make_uncached(calls, result):
    async def fake(query, budget_max, category, country, city):
        calls.append(query)
        return list(result)
    return fake


async def test_second_identical_query_hits_cache(monkeypatch):
    calls = []
    monkeypatch.setattr(
        shop, "_search_grounded_uncached", _make_uncached(calls, ["item"])
    )
    r1 = await shop._search_grounded("Denim Jacket", 80, "tops", "AZ", "Baku")
    r2 = await shop._search_grounded("  denim jacket ", 80, "tops", "AZ", "Baku")
    assert r1 == r2 == ["item"]
    assert len(calls) == 1  # second call served from cache


async def test_empty_results_not_cached(monkeypatch):
    calls = []
    monkeypatch.setattr(shop, "_search_grounded_uncached", _make_uncached(calls, []))
    await shop._search_grounded("q", None, None, None, None)
    await shop._search_grounded("q", None, None, None, None)
    assert len(calls) == 2


async def test_expired_entry_refetches(monkeypatch):
    calls = []
    monkeypatch.setattr(shop, "_search_grounded_uncached", _make_uncached(calls, ["x"]))
    now = [1_000_000.0]
    monkeypatch.setattr(shop, "_cache_now", lambda: now[0])
    await shop._search_grounded("q", None, None, None, None)
    now[0] += shop._GROUNDED_TTL + 1
    await shop._search_grounded("q", None, None, None, None)
    assert len(calls) == 2


async def test_cap_evicts_oldest(monkeypatch):
    monkeypatch.setattr(shop, "_GROUNDED_CACHE_MAX", 2)
    calls = []
    monkeypatch.setattr(shop, "_search_grounded_uncached", _make_uncached(calls, ["x"]))
    await shop._search_grounded("a", None, None, None, None)
    await shop._search_grounded("b", None, None, None, None)
    await shop._search_grounded("c", None, None, None, None)
    assert len(shop._GROUNDED_CACHE) == 2
    keys = {k[0] for k in shop._GROUNDED_CACHE}
    assert "a" not in keys  # oldest evicted
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_grounded_cache.py -v`
Expected: FAIL — `AttributeError: ... has no attribute '_GROUNDED_CACHE'`.

- [x] **Step 3: Implement the cache**

In `backend/app/services/shopping_service.py`:

1. Rename the existing `async def _search_grounded(` to `async def _search_grounded_uncached(` (body unchanged).

2. Directly above it, add:

```python
_GROUNDED_TTL = 12 * 3600  # seconds — quota shield, not a datastore
_GROUNDED_CACHE_MAX = 200
_GROUNDED_CACHE: dict[tuple, tuple[float, list]] = {}


def _cache_now() -> float:
    return time.time()


async def _search_grounded(
    query: str,
    budget_max: float | None,
    category: str | None,
    country: str | None,
    city: str | None,
) -> list[ShoppingResultItem]:
    key = (query.strip().lower(), budget_max, category, country, city)
    hit = _GROUNDED_CACHE.get(key)
    if hit is not None:
        expires_at, items = hit
        if expires_at > _cache_now():
            return list(items)
        del _GROUNDED_CACHE[key]

    items = await _search_grounded_uncached(query, budget_max, category, country, city)
    if items:  # never cache empty/error results
        now = _cache_now()
        expired = [k for k, (exp, _) in _GROUNDED_CACHE.items() if exp <= now]
        for k in expired:
            del _GROUNDED_CACHE[k]
        while len(_GROUNDED_CACHE) >= _GROUNDED_CACHE_MAX:
            del _GROUNDED_CACHE[next(iter(_GROUNDED_CACHE))]  # oldest insert
        _GROUNDED_CACHE[key] = (now + _GROUNDED_TTL, list(items))
    return items
```

3. Ensure `import time` exists in the module's import block (add it if missing).

- [x] **Step 4: Run tests to verify they pass**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_grounded_cache.py -v`
Expected: 4 PASSED.

- [x] **Step 5: Full suite + commit**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -q`
Expected: 70 passed (existing `test_grounded_search.py` must stay green — it targets `llm_service` parsing, not this wrapper).

```bash
cd C:/Users/Envy/Desktop/VTO
git add backend/app/services/shopping_service.py backend/tests/test_grounded_cache.py
git commit -m "feat(shop): 12h in-process TTL cache for grounded Gemini search

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Retire POST /stylist/ask everywhere

**Files:**
- Modify: `backend/app/routers/stylist.py` (delete route + imports)
- Modify: `backend/app/services/stylist_service.py` (delete `ask_stylist` + import)
- Modify: `backend/app/services/llm_service.py` (delete `stylist_ask_structured` + `STYLIST_ASK_STRUCTURED`)
- Modify: `backend/app/schemas/stylist.py` (delete `StylistAskRequest`, `StylistAskResponse`)
- Modify: `mobile/src/lib/api.ts` (delete `stylistAsk`)
- Modify: `frontend/src/lib/api.ts` (delete `stylistAsk`)
- Modify: `README.md` (drop the `/stylist/ask` endpoint line)
- Test: `backend/tests/test_email_verification_api.py` (append one test)

**Interfaces:**
- Consumes: nothing.
- Produces: `/stylist/ask` gone from `app.routes`. `/suggest`, `/reroll`, `/chat`, `/messages` untouched.

- [x] **Step 1: Append the failing test**

Append to `backend/tests/test_email_verification_api.py`:

```python
def test_legacy_ask_route_removed():
    from app.main import app

    paths = {getattr(r, "path", "") for r in app.routes}
    assert "/stylist/ask" not in paths
```

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_email_verification_api.py::test_legacy_ask_route_removed -v`
Expected: FAIL — route still present.

- [x] **Step 2: Delete backend pieces**

1. `backend/app/routers/stylist.py`: delete the whole `@router.post("/ask", ...)` block (lines ~101-112); remove `StylistAskRequest` and `StylistAskResponse` from the schema import; change the service import to `from app.services.stylist_service import chat_with_stylist, suggest_outfit`.
2. `backend/app/services/stylist_service.py`: delete the whole `async def ask_stylist(...)` function; remove `stylist_ask_structured` from the `llm_service` import line (keep `LlmError`, `stylist_suggest`).
3. `backend/app/services/llm_service.py`: delete the `STYLIST_ASK_STRUCTURED = """..."""` constant and the whole `async def stylist_ask_structured(...)` function.
4. `backend/app/schemas/stylist.py`: delete the `StylistAskRequest` and `StylistAskResponse` classes.

- [x] **Step 3: Delete client methods + README line**

1. `mobile/src/lib/api.ts`: delete the `stylistAsk(...)` method (the `request<{ reply: string; chips?: string[] | null }>('/stylist/ask', ...)` block).
2. `frontend/src/lib/api.ts`: delete the equivalent `stylistAsk` method.
3. `README.md`: delete the line `` - `POST /stylist/ask` — Free-form chat (returns reply + quick-reply chips) ``.

- [x] **Step 4: Verify everything, commit**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -q`
Expected: 71 passed.
Run: `cd C:/Users/Envy/Desktop/VTO/mobile && npm run typecheck && npm run lint`
Expected: clean / 0 errors (proves nothing referenced `stylistAsk`).
Run: `grep -rn "stylist_ask\|stylistAsk\|/stylist/ask" backend/app mobile/src frontend/src README.md`
Expected: no matches.

```bash
cd C:/Users/Envy/Desktop/VTO
git add backend/app/routers/stylist.py backend/app/services/stylist_service.py \
        backend/app/services/llm_service.py backend/app/schemas/stylist.py \
        mobile/src/lib/api.ts frontend/src/lib/api.ts README.md \
        backend/tests/test_email_verification_api.py
git commit -m "refactor(stylist): retire legacy POST /stylist/ask

/stylist/chat replaced it on web and mobile; zero callers remained.
/suggest and /reroll stay (mobile Suggest/Shuffle).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Mobile — verify-email screen and entry points

**Files:**
- Modify: `mobile/src/lib/api.ts` (UserMe flag + two methods)
- Create: `mobile/app/verify-email.tsx`
- Modify: `mobile/app/settings/index.tsx` (verification row)
- Modify: `mobile/app/(tabs)/studio.tsx` (403 handling)
- Modify: `mobile/src/features/stylist/ChatActionCards.tsx` (403 handling)
- Test: `mobile/__tests__/verifyEmail.test.tsx` (create)

**Interfaces:**
- Consumes: backend `POST /auth/verify/request`, `POST /auth/verify {code}`, `UserMe.email_verified`, 403 `detail="email_unverified"` (surfaced as `Error.message` by the api client's `request()`).
- Produces: `api.requestVerification() -> Promise<{message}>`; `api.verifyEmail(code: string) -> Promise<{message}>`; route `/verify-email`.

- [x] **Step 1: api client**

In `mobile/src/lib/api.ts`:

1. Add `email_verified?: boolean;` to the `UserMe` type (after `lng`).
2. After the `resetPassword` method, add:

```typescript
  requestVerification() {
    return request<{ message: string }>('/auth/verify/request', { method: 'POST' });
  },
  verifyEmail(code: string) {
    return request<{ message: string }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },
```

- [x] **Step 2: Write the failing screen test**

Create `mobile/__tests__/verifyEmail.test.tsx`:

```tsx
import React from 'react';
import { waitFor } from '@testing-library/react-native';
import { mockTheme, mockStyles, makeWrapper } from '../src/__mocks__/testUtils';

jest.mock('react-native-unistyles', () => ({
  useStyles: () => ({ styles: mockStyles, theme: mockTheme }),
  createStyleSheet: (fn: unknown) => fn,
}));
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn(), push: jest.fn() }),
  Link: ({ children }: any) => children,
}));

const mockVerify = jest.fn().mockResolvedValue({ message: 'ok' });
const mockResend = jest.fn().mockResolvedValue({ message: 'sent' });
jest.mock('../src/lib/api', () => ({
  api: {
    verifyEmail: (...a: unknown[]) => mockVerify(...a),
    requestVerification: (...a: unknown[]) => mockResend(...a),
  },
}));

import { render, fireEvent } from '@testing-library/react-native';
import VerifyEmailScreen from '../app/verify-email';

describe('VerifyEmailScreen', () => {
  it('submits the code and goes back on success', async () => {
    const { getByPlaceholderText, getByText } = await render(<VerifyEmailScreen />, {
      wrapper: makeWrapper(),
    });
    await fireEvent.changeText(getByPlaceholderText('6-digit code'), '123456');
    await fireEvent.press(getByText('Verify'));
    await waitFor(() => expect(mockVerify).toHaveBeenCalledWith('123456'));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('fires resend', async () => {
    const { getByText } = await render(<VerifyEmailScreen />, { wrapper: makeWrapper() });
    await fireEvent.press(getByText('Resend code'));
    await waitFor(() => expect(mockResend).toHaveBeenCalled());
  });
});
```

Run: `cd C:/Users/Envy/Desktop/VTO/mobile && npx jest __tests__/verifyEmail.test.tsx --ci`
Expected: FAIL — `Cannot find module '../app/verify-email'`.

- [x] **Step 3: Screen**

Create `mobile/app/verify-email.tsx`:

```tsx
import React, { useState } from 'react';
import { Text, KeyboardAvoidingView, Platform, ScrollView, View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useStyles, createStyleSheet } from 'react-native-unistyles';

import { api } from '../src/lib/api';
import { Button } from '../src/components/ui/Button';
import { Input } from '../src/components/ui/Input';
import { useToast } from '../src/components/ui/Toast';

export default function VerifyEmailScreen() {
  const { styles, theme } = useStyles(stylesheet);
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function submit() {
    if (!/^\d{6}$/.test(code.trim())) {
      toast('error', 'Enter the 6-digit code from your email');
      return;
    }
    setLoading(true);
    try {
      await api.verifyEmail(code.trim());
      qc.invalidateQueries({ queryKey: ['me'] });
      toast('success', 'Email verified — renders unlocked');
      router.back();
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      await api.requestVerification();
      toast('success', 'New code sent — check your inbox');
    } catch (e: unknown) {
      toast('error', e instanceof Error ? e.message : 'Could not send code');
    } finally {
      setResending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            Paste the 6-digit code we emailed you to unlock try-on renders
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Verification code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="6-digit code"
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          <Button label="Verify" onPress={submit} loading={loading} fullWidth />
          <TouchableOpacity onPress={resend} disabled={resending}>
            <Text style={[styles.foot, { color: theme.colors.accent, fontWeight: '700' }]}>
              Resend code
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const stylesheet = createStyleSheet((theme) => ({
  scroll: { flex: 1, backgroundColor: theme.colors.background },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.xl,
  },
  header: { alignItems: 'center', gap: theme.spacing.xs },
  title: {
    fontFamily: theme.typography.families.sans,
    fontWeight: theme.typography.weights.extrabold,
    fontSize: theme.typography.sizes.xxl,
    color: theme.colors.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.muted,
    textAlign: 'center',
  },
  form: { gap: theme.spacing.md },
  foot: {
    textAlign: 'center',
    fontFamily: theme.typography.families.sans,
    fontSize: theme.typography.sizes.sm,
    marginTop: theme.spacing.xs,
  },
}));
```

Run: `cd C:/Users/Envy/Desktop/VTO/mobile && npx jest __tests__/verifyEmail.test.tsx --ci`
Expected: 2 PASSED.

- [x] **Step 4: Settings row**

In `mobile/app/settings/index.tsx`:

1. Extend imports: add `useQueryClient` to the `@tanstack/react-query` import (already imports `useMutation, useQuery`).
2. Inside `SettingsScreen`'s JSX, insert `<EmailSection />` directly above `<UsageSection />`.
3. Add the component after `UsageSection`:

```tsx
function EmailSection() {
  const { styles, theme } = useStyles(stylesheet);
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: api.me });

  if (!user) return null;

  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Email</Text>
      <View style={styles.usageRow}>
        <Text style={styles.usageLabel} numberOfLines={1}>{user.email}</Text>
        {user.email_verified ? (
          <Text style={styles.usageValue}>Verified ✓</Text>
        ) : (
          <Link href="/verify-email" style={{ color: theme.colors.accent, fontWeight: '700', fontSize: 13 }}>
            Verify email →
          </Link>
        )}
      </View>
    </Card>
  );
}
```

- [x] **Step 5: 403 handling at the two render call sites**

1. `mobile/app/(tabs)/studio.tsx`: add `import { useRouter } from 'expo-router';` to the imports, `const router = useRouter();` next to the other hooks in the component, and replace `submitMutation`'s `onError` line with:

```tsx
    onError: (e: Error) => {
      if (e.message === 'email_unverified') {
        toast('error', 'Verify your email to render');
        router.push('/verify-email');
      } else {
        toast('error', e.message);
      }
    },
```

2. `mobile/src/features/stylist/ChatActionCards.tsx`: add `import { useToast } from '../../components/ui/Toast';`, `const toast = useToast();` inside `OutfitSuggestionCard`, and extend the `tryOn` mutation with an `onError` after `onSuccess`:

```tsx
    onError: (e: Error) => {
      if (e.message === 'email_unverified') {
        toast('error', 'Verify your email to render');
        router.push('/verify-email');
      } else {
        toast('error', e.message);
      }
    },
```

- [x] **Step 6: Typed routes, full check, commit**

Regenerate typed routes (see Global Constraints — new route `verify-email` must appear in `mobile/.expo/types/router.d.ts`).

Run: `cd C:/Users/Envy/Desktop/VTO/mobile && npm run typecheck && npm run lint && npx jest --ci`
Expected: typecheck clean, lint 0 errors, 33 tests pass (31 + 2).

```bash
cd C:/Users/Envy/Desktop/VTO
git add mobile/src/lib/api.ts mobile/app/verify-email.tsx mobile/app/settings/index.tsx \
        "mobile/app/(tabs)/studio.tsx" mobile/src/features/stylist/ChatActionCards.tsx \
        mobile/__tests__/verifyEmail.test.tsx
git commit -m "feat(mobile): verify-email screen + render-gate handling

Settings shows verification state; studio and outfit-card renders
route 403 email_unverified to the verify screen.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Live verification

**Files:** none.

- [x] **Step 1: Suite + boot**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -q` → 71 passed.
Stack up (`docker compose up -d`), then: `curl -s http://localhost:8000/health` → `{"status":"ok","db":true}`.

- [x] **Step 2: Verification gate end-to-end (console email backend)**

```bash
# fresh account
curl -s -X POST http://localhost:8000/auth/register -H "Content-Type: application/json" \
  -d '{"email": "verify.smoke.0706@example.com", "password": "smokepass123"}'
# → save access_token as $T

# render blocked
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/tryon/outfit \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"item_ids": []}'
# Expected: 403 (and body detail=email_unverified via a non -o run)

# code arrives at signup automatically
docker logs vto-backend-1 --tail 20   # shows "Verification code (paste it in the app): NNNNNN"

curl -s -X POST http://localhost:8000/auth/verify -H "Authorization: Bearer $T" \
  -H "Content-Type: application/json" -d '{"code": "<NNNNNN from log>"}'
# Expected: 200 "Email verified — renders unlocked."

curl -s http://localhost:8000/auth/me -H "Authorization: Bearer $T"
# Expected: "email_verified": true

curl -s -X POST http://localhost:8000/tryon/outfit -H "Authorization: Bearer $T" \
  -H "Content-Type: application/json" -d '{"item_ids": []}'
# Expected: no longer 403 email_unverified (a 4xx about empty item_ids/avatar is fine — gate passed)
```

- [x] **Step 3: /stylist/ask is gone; cache logs one Gemini call**

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/stylist/ask \
  -H "Authorization: Bearer $T" -H "Content-Type: application/json" -d '{"prompt": "x"}'
# Expected: 404

# same grounded query twice (needs an account with country where SerpAPI misses, or serpapi_key unset)
curl -s -X POST http://localhost:8000/shopping/search -H "Authorization: Bearer $T" \
  -H "Content-Type: application/json" -d '{"query": "cache smoke jacket"}' > /dev/null
curl -s -X POST http://localhost:8000/shopping/search -H "Authorization: Bearer $T" \
  -H "Content-Type: application/json" -d '{"query": "cache smoke jacket"}' > /dev/null
docker logs vto-backend-1 --tail 40
# Expected: one gemini call logged for the pair (second request silent) — only assertable
# when the grounded path actually ran; if SerpAPI served both, note it and rely on Task 3 tests.
```

- [x] **Step 4: Mobile static checks**

Run: `cd C:/Users/Envy/Desktop/VTO/mobile && npm run typecheck && npm run lint && npx jest --ci`
Expected: clean / 0 errors / 33 pass.

On-device visual QA (verify-email screen, settings row, studio 403 redirect) stays with the owner — note in the completion report, do not block on it.

- [x] **Step 5: Commit fixes if any**

```bash
git add -A backend mobile
git commit -m "fix: follow-ups from verification/cleanup/cache live verification

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** column+table+service (Task 1), endpoints+/me+gate+rate-limit (Task 2), cache on `_search_grounded` only (Task 3), /ask retirement incl. `stylist_ask_structured`/constant/schemas/clients/README (Task 4), mobile screen+settings row+both render call sites (Task 5), live verification incl. exact-line email check (Tasks 1 test + 6). Out-of-scope list respected — no grandfathering, no deep links, no /suggest//reroll changes.
- **Type consistency:** `request_verification(db, user)` / `verify_email(db, user, code)` used identically in Tasks 1, 2; `_check_verified(user)` defined Task 2 Step 5, tested Step 1; `_search_grounded_uncached` name matches between Task 3 test monkeypatch and implementation; mobile `verifyEmail(code)` / `requestVerification()` match Task 5 test mocks; 403 detail string `email_unverified` identical in backend, tests, and both mobile handlers.
- **Placeholder scan:** every code step carries full code; every run step has expected output; test counts chained (58→62→66→70→71 backend, 31→33 mobile).
- **Known judgment call:** Task 6 Step 3's cache smoke depends on the grounded path actually running (SerpAPI may serve first); the step says how to handle that instead of pretending it's deterministic.
