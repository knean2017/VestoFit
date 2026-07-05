# Reliability & Observability Implementation Plan

> **STATUS: COMPLETE (2026-07-05).** All tasks implemented TDD-first, 53/53 backend tests pass. Live-verified: /health 200 `{"status":"ok","db":true}` → 503 `{"status":"degraded","db":false}` with db stopped → 200 after restart; real Gemini 400 (bogus key, one-off container run) produced `WARNING fitme.llm gemini call failed: status=400 model=gemini-2.5-flash-lite grounded=False` and `LlmError.status_code=400`. 429/503 fallback copy covered by unit test (live rate-limit not forceable on demand). Note: /health pre-existed as a static route; upgraded in place with the db ping.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner can tell "outage vs quota vs bug" from logs and a health check, and users get honest messaging when the AI is rate-limited instead of a generic "trouble thinking".

**Architecture:** Three thin layers. (1) `GET /health` pings the DB for deploy/uptime checks. (2) A logging pass: named loggers (`fitme.llm`, `fitme.tryon`, `fitme.http`) with a basicConfig in `main.py`; `_gemini_generate` logs every non-2xx with status + model before raising; a middleware logs requests slower than 2s. (3) `LlmError` gains a `status_code` attribute so the stylist-chat fallback can say "I'm getting a lot of requests right now — try again in a minute" for 429/503 vs the generic message for real failures.

**Tech Stack:** FastAPI middleware, stdlib `logging`, existing pytest harness.

## Global Constraints

- No new dependencies, no external services (Sentry etc. deliberately out of scope).
- `GET /health` is unauthenticated, returns 200 `{"status": "ok", "db": true}` or 503 `{"status": "degraded", "db": false}`; it must never raise.
- Log lines must include enough to act on: logger name, status/model for LLM calls, method+path+ms for slow requests. No request bodies, no tokens, no user emails in logs.
- `LlmError` stays a `RuntimeError` subclass and keeps its message format — existing `except LlmError` sites must not change behavior, they just gain optional `status_code` introspection (default `None`).
- Rate-limited chat fallback copy (exact): `"I'm getting a lot of requests right now — give me a minute and try again."` with chips `["Try again"]`. Non-rate-limit fallback keeps the existing copy.
- Backend tests run from `backend/`: `python -m pytest tests -v`.

---

### Task 1: GET /health

**Files:**
- Modify: `backend/app/main.py` (add route after app creation / router includes)
- Test: `backend/tests/test_health.py`

**Interfaces:**
- Consumes: `engine` from `app.database`.
- Produces: `GET /health` as specified in Global Constraints; helper `async _db_ok() -> bool` in `main.py`.

- [x] **Step 1: Write the failing test**

`backend/tests/test_health.py`:

```python
from app.main import app, _db_ok


def test_health_route_registered():
    assert any(getattr(r, "path", "") == "/health" for r in app.routes)


async def test_db_ok_false_when_engine_unreachable(monkeypatch):
    import app.main as main

    class BoomEngine:
        def connect(self):
            raise ConnectionError("db down")

    monkeypatch.setattr(main, "engine", BoomEngine())
    assert await _db_ok() is False
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_health.py -v`
Expected: FAIL with `ImportError: cannot import name '_db_ok'`.

- [x] **Step 3: Implement**

In `backend/app/main.py` (after the FastAPI app is created and routers included; `engine` is already imported, extend imports with `text` from sqlalchemy and `JSONResponse` from fastapi.responses):

```python
async def _db_ok() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


@app.get("/health", tags=["ops"])
async def health():
    db_up = await _db_ok()
    body = {"status": "ok" if db_up else "degraded", "db": db_up}
    return JSONResponse(body, status_code=200 if db_up else 503)
```

- [x] **Step 4: Run tests, commit**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -q`
Expected: all PASSED.

```bash
git add backend/app/main.py backend/tests/test_health.py
git commit -m "feat(ops): unauthenticated /health with db ping"
```

---

### Task 2: Logging — config, LLM failure logs, slow-request middleware

**Files:**
- Modify: `backend/app/main.py` (logging config at import time; middleware after app creation)
- Modify: `backend/app/services/llm_service.py` (logger + log before raising in `_gemini_generate`)
- Test: `backend/tests/test_llm_logging.py`

**Interfaces:**
- Produces: loggers `fitme.llm` (LLM failures: status, model) and `fitme.http` (requests slower than 2000 ms: method, path, duration). Task 3 relies on the same `_gemini_generate` error path.

- [x] **Step 1: Write the failing test**

`backend/tests/test_llm_logging.py`:

```python
import logging

import pytest

from app.services import llm_service
from app.services.llm_service import LlmError


class FakeResponse:
    status_code = 503
    text = '{"error": {"status": "UNAVAILABLE"}}'

    def json(self):
        return {}


class FakeClient:
    def __init__(self, *a, **k): ...
    async def __aenter__(self):
        return self
    async def __aexit__(self, *exc):
        return False
    async def post(self, url, **kwargs):
        return FakeResponse()


async def test_gemini_failure_is_logged_with_status_and_model(monkeypatch, caplog):
    monkeypatch.setattr(llm_service.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(llm_service._settings, "gemini_api_key", "k")

    async def no_sleep(_s):
        return None

    monkeypatch.setattr(llm_service.asyncio, "sleep", no_sleep)

    with caplog.at_level(logging.WARNING, logger="fitme.llm"):
        with pytest.raises(LlmError):
            await llm_service._gemini_generate([{"text": "hi"}], json_mode=False)

    joined = " ".join(r.message for r in caplog.records)
    assert "503" in joined
    assert llm_service._settings.llm_model in joined
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_llm_logging.py -v`
Expected: FAIL (no log records captured).

- [x] **Step 3: Implement**

In `backend/app/services/llm_service.py`: add `import logging` to the stdlib imports and `_log = logging.getLogger("fitme.llm")` next to `_settings`. In `_gemini_generate`, directly before the existing `raise LlmError(f"Gemini error ...")` line, add:

```python
        if r.status_code >= 400:
            _log.warning(
                "gemini call failed: status=%s model=%s grounded=%s",
                r.status_code, model, grounded,
            )
            raise LlmError(f"Gemini error ({r.status_code}): {r.text[:300]}")
```

(That is: extend the existing block — keep the raise message identical.)

In `backend/app/main.py`, near the top after imports:

```python
import logging
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
_http_log = logging.getLogger("fitme.http")
```

After the app is created:

```python
@app.middleware("http")
async def slow_request_logger(request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - start) * 1000
    if elapsed_ms > 2000:
        _http_log.warning(
            "slow request: %s %s took %.0fms status=%s",
            request.method, request.url.path, elapsed_ms, response.status_code,
        )
    return response
```

- [x] **Step 4: Run tests, commit**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -q`
Expected: all PASSED.

```bash
git add backend/app/main.py backend/app/services/llm_service.py backend/tests/test_llm_logging.py
git commit -m "feat(ops): fitme loggers — LLM failure logs + slow-request middleware"
```

---

### Task 3: Honest rate-limit messaging in stylist chat

**Files:**
- Modify: `backend/app/services/llm_service.py` (`LlmError` class + the raise site)
- Modify: `backend/app/services/stylist_service.py` (`chat_with_stylist` fallback branch)
- Test: `backend/tests/test_chat_with_stylist.py` (append one test)

**Interfaces:**
- Produces: `LlmError.status_code: int | None` (constructor: `LlmError(message, status_code=None)`); rate-limited fallback copy from Global Constraints.

- [x] **Step 1: Append the failing test**

Append to `backend/tests/test_chat_with_stylist.py`:

```python
async def test_rate_limited_llm_gets_honest_fallback(base, monkeypatch):
    from app.services.llm_service import LlmError

    async def busy(catalog, prompt, **kwargs):
        raise LlmError("Gemini error (429): quota", status_code=429)

    monkeypatch.setattr(llm, "stylist_chat", busy)
    db = FakeDB()
    out = await chat_with_stylist(db, USER, "hi")
    assert "a lot of requests" in out["reply"]
    assert out["chips"] == ["Try again"]
```

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_chat_with_stylist.py -v`
Expected: new test FAILS (`TypeError` on status_code kwarg).

- [x] **Step 2: Extend LlmError and the raise site**

In `backend/app/services/llm_service.py`, replace the `LlmError` class:

```python
class LlmError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code
```

At the `_gemini_generate` raise site (from Task 2's block), pass the status:

```python
            raise LlmError(
                f"Gemini error ({r.status_code}): {r.text[:300]}",
                status_code=r.status_code,
            )
```

- [x] **Step 3: Branch the chat fallback**

In `backend/app/services/stylist_service.py`, in `chat_with_stylist`, replace the `except LlmError:` block with:

```python
    except LlmError as e:
        if e.status_code in (429, 503):
            reply_text = (
                "I'm getting a lot of requests right now — give me a minute and try again."
            )
        else:
            reply_text = (
                "I'm having trouble thinking right now — give me a moment and try again."
            )
        parsed = {"reply": reply_text, "chips": ["Try again"], "action": None}
```

- [x] **Step 4: Full suite, commit**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -v`
Expected: all PASSED (including the five pre-existing chat tests — the generic message is unchanged for `status_code=None`).

```bash
git add backend/app/services/llm_service.py backend/app/services/stylist_service.py backend/tests/test_chat_with_stylist.py
git commit -m "feat(stylist): honest rate-limit fallback + LlmError status_code"
```

---

### Task 4: Live verification

**Files:** none.

- [x] **Step 1: Health check**

`docker compose up -d db backend`, then `curl http://localhost:8000/health` → `{"status":"ok","db":true}`. Stop the db (`docker compose stop db`) → `/health` returns 503 with `"db": false` (backend may need a few seconds to notice). Start db again.

- [x] **Step 2: Log evidence**

Trigger one stylist chat while Gemini is rate-limited (or temporarily set an invalid `GEMINI_API_KEY` in the container env) → `docker logs vto-backend-1` shows a `fitme.llm` warning with status + model, and the chat API returns the appropriate fallback copy.

- [x] **Step 3: Commit fixes if any**

```bash
git add -A backend/app
git commit -m "fix(ops): observability follow-ups from live verification"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Coverage:** deploy/uptime signal (/health), actionable failure logs without PII, honest user messaging for the failure mode we hit repeatedly today (Gemini 429/503 — observed during the 2026-07-04 shopping/stylist verification sessions).
- **Deliberate cuts:** external error tracking (Sentry), metrics/tracing stacks, log shipping — premature for a single-container deployment; the named-logger convention makes adding them later mechanical.
- **Type consistency:** `LlmError(message, status_code=None)` is backward-compatible with every existing single-argument raise; only the `_gemini_generate` HTTP site sets a status. Fallback copy strings match between Global Constraints, Task 3 code, and its test.
