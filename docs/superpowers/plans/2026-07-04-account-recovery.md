# Account Recovery (Password Reset + Email Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A user who forgot their password can get back into their account without human support — via an emailed reset link — and the app gains a pluggable email service that later features (verification, notifications) can reuse.

**Architecture:** New `password_reset_tokens` table (token stored as SHA-256 hash, 30-minute expiry, single-use). `email_service` with two backends selected by settings: SMTP when `SMTP_HOST` is set, console logging otherwise (dev default — the reset link appears in backend logs). `POST /auth/forgot` always returns 202 (no account enumeration); `POST /auth/reset` validates the token and rotates the password. Two small frontend pages, plus a "Forgot password?" link on login.

**Tech Stack:** FastAPI, SQLAlchemy async (new table via existing `create_all` startup), `aiosmtplib` (new dep) for SMTP, stdlib `secrets`/`hashlib`, Next.js 15.

## Global Constraints

- `POST /auth/forgot` responds **202 with the same body whether or not the email exists** — never confirm account existence.
- Reset tokens: `secrets.token_urlsafe(32)`, stored only as SHA-256 hex; expire 30 minutes after creation; single-use; issuing a new token invalidates prior unused ones for that user.
- Both new endpoints reuse the existing `rate_limit_auth` dependency from `app.deps` (same as register/login).
- Password rules match register: min 8 chars (mirror whatever `RegisterRequest` enforces — check `app/schemas/auth.py` and copy the constraint).
- New settings (all optional, console backend when `smtp_host` empty): `smtp_host: str = ""`, `smtp_port: int = 587`, `smtp_user: str = ""`, `smtp_password: str = ""`, `email_from: str = "FitMe <no-reply@fitme.app>"`. Document them in `backend/.env.example`.
- Reset link format: `{settings.frontend_url}/reset-password?token={token}`.
- Backend tests run from `backend/`: `python -m pytest tests -v`. Frontend must pass `npx tsc --noEmit`.

---

### Task 1: Email service with console + SMTP backends

**Files:**
- Modify: `backend/app/config.py` (append the five settings fields above to the Settings class)
- Modify: `backend/requirements.txt` (add `aiosmtplib==3.0.2`)
- Modify: `backend/.env.example` (document SMTP_* and EMAIL_FROM)
- Create: `backend/app/services/email_service.py`
- Test: `backend/tests/test_email_service.py`

**Interfaces:**
- Produces: `async send_email(to: str, subject: str, body: str) -> None`. Console backend logs via `logging.getLogger("fitme.email")`; SMTP backend used when `settings.smtp_host` is truthy. Task 2 calls this.

- [x] **Step 1: Write the failing tests**

`backend/tests/test_email_service.py`:

```python
import logging

from app.services import email_service
from app.services.email_service import send_email


async def test_console_backend_logs_when_no_smtp_host(monkeypatch, caplog):
    monkeypatch.setattr(email_service._settings, "smtp_host", "")
    with caplog.at_level(logging.INFO, logger="fitme.email"):
        await send_email("user@example.com", "Reset your password", "click here: http://x")
    joined = " ".join(r.message for r in caplog.records)
    assert "user@example.com" in joined
    assert "http://x" in joined


async def test_smtp_backend_called_when_host_set(monkeypatch):
    sent = {}

    async def fake_smtp_send(message, hostname, port, username, password, start_tls):
        sent["hostname"] = hostname
        sent["to"] = message["To"]
        sent["subject"] = message["Subject"]

    monkeypatch.setattr(email_service._settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(email_service._settings, "smtp_user", "u")
    monkeypatch.setattr(email_service._settings, "smtp_password", "p")
    monkeypatch.setattr(email_service, "_smtp_send", fake_smtp_send)
    await send_email("user@example.com", "Hello", "body")
    assert sent["hostname"] == "smtp.example.com"
    assert sent["to"] == "user@example.com"
    assert sent["subject"] == "Hello"
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_email_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.email_service'`

- [x] **Step 3: Add settings, dep, and implement**

Append inside the Settings class in `backend/app/config.py`:

```python
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    email_from: str = "FitMe <no-reply@fitme.app>"
```

Add `aiosmtplib==3.0.2` to `backend/requirements.txt` and run `pip install aiosmtplib==3.0.2`.

Append to `backend/.env.example`:

```
# Email (optional — reset links are logged to the backend console when unset)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=FitMe <no-reply@fitme.app>
```

`backend/app/services/email_service.py`:

```python
"""Outbound email — SMTP when configured, console logging otherwise."""

from __future__ import annotations

import logging
from email.message import EmailMessage

from app.config import get_settings

_settings = get_settings()
_log = logging.getLogger("fitme.email")


async def _smtp_send(message, hostname, port, username, password, start_tls):
    import aiosmtplib

    await aiosmtplib.send(
        message,
        hostname=hostname,
        port=port,
        username=username or None,
        password=password or None,
        start_tls=start_tls,
    )


async def send_email(to: str, subject: str, body: str) -> None:
    if not _settings.smtp_host:
        _log.info("EMAIL (console backend) to=%s subject=%r\n%s", to, subject, body)
        return

    message = EmailMessage()
    message["From"] = _settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    await _smtp_send(
        message,
        hostname=_settings.smtp_host,
        port=_settings.smtp_port,
        username=_settings.smtp_user,
        password=_settings.smtp_password,
        start_tls=True,
    )
```

- [x] **Step 4: Run tests to verify pass, then commit**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_email_service.py -v`
Expected: 2 PASSED.

```bash
git add backend/app/config.py backend/requirements.txt backend/.env.example backend/app/services/email_service.py backend/tests/test_email_service.py
git commit -m "feat(email): pluggable email service (console/SMTP backends)"
```

---

### Task 2: Reset-token model + password_reset_service

**Files:**
- Create: `backend/app/models/password_reset.py`
- Modify: `backend/app/models/__init__.py` (import + `__all__` entry, same pattern as `StyleProfile`)
- Create: `backend/app/services/password_reset_service.py`
- Test: `backend/tests/test_password_reset_service.py`

**Interfaces:**
- Consumes: `send_email` (Task 1), `hash_password` from `app.services.auth_service`, `User` model.
- Produces (Task 3 uses):
  - Model `PasswordResetToken` (`password_reset_tokens`: `id`, `user_id` FK indexed, `token_hash: str unique`, `expires_at`, `used_at: nullable`, `created_at`)
  - `class ResetTokenError(RuntimeError)`
  - `_hash_token(raw: str) -> str` — sha256 hexdigest
  - `async request_reset(db, email: str) -> None` — silent no-op for unknown email; else invalidates old tokens, creates one, emails the link
  - `async reset_password(db, token: str, new_password: str) -> None` — raises `ResetTokenError("This reset link is invalid or has expired")` for unknown/expired/used tokens

- [x] **Step 1: Write the failing tests**

`backend/tests/test_password_reset_service.py`:

```python
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


def _noop_async():
    async def f(*a, **k):
        return None
    return f


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


async def test_reset_password_rejects_unknown_token(monkeypatch):
    async def no_row(db, token_hash):
        return None

    monkeypatch.setattr(prs, "_get_valid_token", no_row)
    with pytest.raises(ResetTokenError):
        await reset_password(FakeDB(), "bogus", "newpass123")


async def test_reset_password_rotates_hash_and_burns_token(monkeypatch):
    user = SimpleNamespace(id=uuid.uuid4(), password_hash="old")
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
    assert user.password_hash != "old"
    assert row.used_at is not None
    assert db.committed
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_password_reset_service.py -v`
Expected: FAIL with `ModuleNotFoundError`.

- [x] **Step 3: Create the model**

`backend/app/models/password_reset.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
```

In `backend/app/models/__init__.py`: add `from app.models.password_reset import PasswordResetToken` (alphabetical, after `outfit`) and `"PasswordResetToken",` to `__all__`.

- [x] **Step 4: Implement the service**

`backend/app/services/password_reset_service.py`:

```python
"""Password reset — single-use, hashed, 30-minute tokens."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.services.auth_service import hash_password

_TOKEN_TTL = timedelta(minutes=30)


class ResetTokenError(RuntimeError):
    pass


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def _get_user_by_email(db: AsyncSession, email: str) -> User | None:
    res = await db.execute(select(User).where(User.email == email))
    return res.scalar_one_or_none()


async def _get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    res = await db.execute(select(User).where(User.id == user_id))
    return res.scalar_one_or_none()


async def _invalidate_tokens(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None))
        .values(used_at=datetime.now(timezone.utc))
    )


async def _get_valid_token(db: AsyncSession, token_hash: str) -> PasswordResetToken | None:
    res = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
    )
    return res.scalar_one_or_none()


async def request_reset(db: AsyncSession, email: str) -> None:
    import app.services.email_service as email_svc

    user = await _get_user_by_email(db, email)
    if user is None:
        return  # never reveal whether the account exists

    await _invalidate_tokens(db, user.id)
    raw = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_token(raw),
            expires_at=datetime.now(timezone.utc) + _TOKEN_TTL,
        )
    )
    await db.commit()

    link = f"{get_settings().frontend_url}/reset-password?token={raw}"
    await email_svc.send_email(
        user.email,
        "Reset your FitMe password",
        "Someone (hopefully you) asked to reset your FitMe password.\n\n"
        f"Reset it here (valid 30 minutes): {link}\n\n"
        "If this wasn't you, ignore this email — your password is unchanged.",
    )


async def reset_password(db: AsyncSession, token: str, new_password: str) -> None:
    row = await _get_valid_token(db, _hash_token(token))
    if row is None:
        raise ResetTokenError("This reset link is invalid or has expired")

    user = await _get_user_by_id(db, row.user_id)
    if user is None:
        raise ResetTokenError("This reset link is invalid or has expired")

    user.password_hash = hash_password(new_password)
    row.used_at = datetime.now(timezone.utc)
    await db.commit()
```

Note: check `app/models/user.py` for the actual password column name (`password_hash` assumed — if it is `hashed_password`, use that name in both service and test).

- [x] **Step 5: Run tests to verify pass, full suite, commit**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -v`
Expected: all PASSED.

```bash
git add backend/app/models/password_reset.py backend/app/models/__init__.py backend/app/services/password_reset_service.py backend/tests/test_password_reset_service.py
git commit -m "feat(auth): password reset tokens + service"
```

---

### Task 3: /auth/forgot and /auth/reset endpoints

**Files:**
- Modify: `backend/app/schemas/auth.py` (append)
- Modify: `backend/app/routers/auth.py` (append)

**Interfaces:**
- Consumes: `request_reset`, `reset_password`, `ResetTokenError` (Task 2); existing `rate_limit_auth` from `app.deps`.
- Produces: `POST /auth/forgot {email}` → 202 `{"message": "If that account exists, a reset link is on its way."}` always; `POST /auth/reset {token, password}` → 200 `{"message": "Password updated — you can sign in now."}` or 400 with the ResetTokenError message.

- [x] **Step 1: Add schemas**

Append to `backend/app/schemas/auth.py` (mirror the password constraint used by `RegisterRequest` in the same file — copy its `Field(...)` exactly):

```python
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=200)
    password: str = Field(..., min_length=8, max_length=100)


class MessageResponse(BaseModel):
    message: str
```

(If `EmailStr` isn't already imported in that file, extend the pydantic import.)

- [x] **Step 2: Add endpoints**

Append to `backend/app/routers/auth.py` (extend schema imports with the three new classes; add `from app.services.password_reset_service import ResetTokenError, request_reset, reset_password`):

```python
@router.post(
    "/forgot",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(rate_limit_auth)],
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await request_reset(db, payload.email)
    return MessageResponse(message="If that account exists, a reset link is on its way.")


@router.post(
    "/reset",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit_auth)],
)
async def do_reset_password(
    payload: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        await reset_password(db, payload.token, payload.password)
    except ResetTokenError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return MessageResponse(message="Password updated — you can sign in now.")
```

(Check the top of `auth.py` — `status` and `HTTPException` are imported there already; if not, extend the fastapi import.)

- [x] **Step 3: Verify routes and suite**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -c "from app.main import app; paths = {getattr(r, 'path', '') for r in app.routes}; assert '/auth/forgot' in paths and '/auth/reset' in paths; print('routes ok')" && python -m pytest tests -q`
Expected: `routes ok`, all PASSED.

- [x] **Step 4: Commit**

```bash
git add backend/app/schemas/auth.py backend/app/routers/auth.py
git commit -m "feat(auth): forgot/reset password endpoints (enumeration-safe)"
```

---

### Task 4: Frontend — forgot + reset pages, login link

**Files:**
- Modify: `frontend/src/lib/api.ts` (two methods after the auth methods)
- Create: `frontend/src/app/forgot-password/page.tsx`
- Create: `frontend/src/app/reset-password/page.tsx`
- Modify: `frontend/src/app/login/page.tsx` (add link near the password field / below the submit button)

**Interfaces:**
- Consumes: Task 3 endpoints.
- Produces: `api.forgotPassword(email)`, `api.resetPassword(token, password)`.

- [x] **Step 1: API methods**

In `frontend/src/lib/api.ts`, add to the `api` object next to the login/register methods:

```typescript
  forgotPassword(email: string) {
    return request<{ message: string }>("/auth/forgot", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
  resetPassword(token: string, password: string) {
    return request<{ message: string }>("/auth/reset", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },
```

- [x] **Step 2: Forgot-password page**

`frontend/src/app/forgot-password/page.tsx` (match the card/field/btn classes used in `login/page.tsx` — read it first and reuse its layout wrapper):

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
    } catch {
      /* same message either way — never reveal account existence */
    }
    setSent(true);
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-bg grid place-items-center px-4">
      <div className="card p-8 w-full max-w-md space-y-5">
        <h1 className="heading-md">Forgot your password?</h1>
        {sent ? (
          <p className="text-sm text-muted">
            If that account exists, a reset link is on its way. Check your inbox
            (and spam folder).
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm text-muted">
              Enter your email and we&apos;ll send you a reset link.
            </p>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="field w-full"
            />
            <button type="submit" disabled={busy || !email.trim()} className="btn-primary w-full py-2.5">
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <Link href="/login" className="block text-sm text-coral font-bold hover:text-ink transition-colors">
          ← Back to sign in
        </Link>
      </div>
    </main>
  );
}
```

- [x] **Step 3: Reset-password page**

`frontend/src/app/reset-password/page.tsx`:

```tsx
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      router.replace("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-muted">
        This link is missing its token. Request a new one from{" "}
        <Link href="/forgot-password" className="text-coral font-bold">forgot password</Link>.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <input
        type="password"
        required
        minLength={8}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (min 8 characters)"
        className="field w-full"
      />
      {error && <p className="text-sm text-coral font-medium">{error}</p>}
      <button type="submit" disabled={busy || password.length < 8} className="btn-primary w-full py-2.5">
        {busy ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-bg grid place-items-center px-4">
      <div className="card p-8 w-full max-w-md space-y-5">
        <h1 className="heading-md">Choose a new password</h1>
        <Suspense fallback={null}>
          <ResetForm />
        </Suspense>
      </div>
    </main>
  );
}
```

- [x] **Step 4: Login page link**

In `frontend/src/app/login/page.tsx`, add directly under the password input (or beside the submit button, matching the page's spacing):

```tsx
<Link href="/forgot-password" className="text-xs text-muted hover:text-coral transition-colors">
  Forgot password?
</Link>
```

(Ensure `Link` is imported.) Optionally: if the page reads search params already, show a success note when `reset=1` is present; skip if it doesn't — the login form works regardless.

- [x] **Step 5: Typecheck and commit**

Run: `cd C:/Users/Envy/Desktop/VTO/frontend && npx tsc --noEmit`
Expected: clean.

```bash
git add frontend/src/lib/api.ts frontend/src/app/forgot-password frontend/src/app/reset-password frontend/src/app/login/page.tsx
git commit -m "feat(auth): forgot/reset password pages + login link"
```

---

### Task 5: Live verification (console email backend)

**Files:** none.

- [x] **Step 1: Full backend suite**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -v` — all PASSED.

- [x] **Step 2: End-to-end reset via logs**

With the docker stack up (`docker compose up -d db backend`):
1. Register `reset-test@example.com` / `OldPass123!`.
2. `POST /auth/forgot {"email": "reset-test@example.com"}` → 202.
3. `docker logs vto-backend-1 --tail 20` → find the logged reset link, extract the token.
4. `POST /auth/reset {"token": "<token>", "password": "NewPass456!"}` → 200.
5. Login with `NewPass456!` → 200; login with `OldPass123!` → 401.
6. Replay the same `POST /auth/reset` → 400 (single-use).
7. `POST /auth/forgot` with a nonsense email → still 202, and no reset link in logs.

- [x] **Step 3: UI pass**

Open `/login` → "Forgot password?" link visible → `/forgot-password` sends and shows the neutral confirmation → paste the logged link → `/reset-password` sets a new password → redirected to login.

- [x] **Step 4: Clean up and commit fixes if any**

```sql
DELETE FROM users WHERE email='reset-test@example.com';
```

```bash
git add -A backend frontend/src
git commit -m "fix(auth): reset flow follow-ups from live verification"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Coverage:** locked-out user recovers unaided (Tasks 2–4), no enumeration (202-always + silent unknown-email path, tested), abuse-limited (rate_limit_auth reuse), email infra reusable for future verification (Task 1 standalone).
- **Deliberate cuts:** email verification at signup (backlog — foundation now exists); HTML email templates (plain text is fine for a reset link); token cleanup job (expired rows are inert; add a cron if the table ever matters).
- **Type consistency:** raw token → `_hash_token` → `token_hash` column (64-char sha256 hex, String(64)); service error message string matches router 400 detail; frontend reads `detail` via existing `request()` error handling.
- **Verify-before-trust:** two "check the actual name" notes (User password column, RegisterRequest password Field) — the implementer must resolve both against the real files, not assume.
