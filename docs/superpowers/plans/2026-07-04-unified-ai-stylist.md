# Unified AI Stylist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the fragmented assistant (three separate single-shot prompts) into one specialized, conversation-first AI stylist with server-side memory that can: chat and motivate, build outfits from the user's wardrobe, find new clothes in nearby/online stores, mix both, answer general styling questions, and give advice based on the user's look (style profile from their avatar photo).

**Architecture:** One new endpoint `POST /stylist/chat` backed by a single-pass action schema: Gemini receives persona + wardrobe catalog + style profile + user location + last 12 persisted messages, and returns `{reply, chips, action}` where `action.type ∈ {outfit, shop, mix, null}`. The backend executes actions (outfit creation reuses `create_outfit`/`validate_combo`; shopping reuses `shopping_service.search_products`) and persists both turns to the existing `stylist_messages` table. A new `style_profiles` table stores fashion-only attributes extracted once from the avatar photo by Gemini vision (user-triggered, editable, deletable). The frontend `StylistChat` stylist mode switches from `/stylist/suggest` + regex intent hack to `/stylist/chat`, rendering chips, outfit results, and inline shop results.

**Tech Stack:** FastAPI, SQLAlchemy async + Postgres (`create_all` + `db_migrate.py` patch style), Gemini 2.5 Flash-Lite REST (text + vision), pytest + pytest-asyncio, Next.js 15 / React 19 / Framer Motion.

## Global Constraints

- Existing endpoints (`/stylist/suggest`, `/reroll`, `/ask`, `/messages`, `/shopping/ask`) keep working unchanged — the studio and shop page depend on them.
- LLM stays Gemini via existing `_gemini_generate`; no new providers, no new env vars.
- Outfit combos must satisfy existing `validate_combo` rules: one dress, OR one top + one bottom, OR two tops + one bottom.
- Wardrobe item ids in LLM output must be validated through `fetch_owned_items` — never trust LLM ids.
- Style-photo analysis extracts **fashion attributes only** (undertone, contrast, best/avoid colors, silhouette notes). The prompt must forbid inferring age, ethnicity, or identity. Analysis is user-triggered, re-runnable, and deletable.
- Persona (use this voice in all new prompts): warm, encouraging, celebrates the user's choices, asks one clarifying question when the request is vague, gently steers off-topic chats back to style — never a cold refusal.
- Backend tests run from `backend/`: `python -m pytest tests -v`.
- Frontend must pass `npx tsc --noEmit` and `npm run lint`.

---

### Task 1: Backend test infrastructure (skip if already present)

Identical to Task 1 of `2026-07-04-grounded-local-shopping.md`. If `backend/pytest.ini` already exists, check this task off and move on.

**Files:**
- Create: `backend/requirements-dev.txt`
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py` (empty)
- Test: `backend/tests/test_shopping_locale.py`

**Interfaces:**
- Produces: working `python -m pytest tests -v` from `backend/`.

- [ ] **Step 1: Check whether infra exists**

Run: `ls C:/Users/Envy/Desktop/VTO/backend/pytest.ini`
If it exists: mark this task complete, go to Task 2.

- [ ] **Step 2: Create dev requirements and pytest config**

`backend/requirements-dev.txt`:

```
pytest==8.3.3
pytest-asyncio==0.24.0
```

`backend/pytest.ini`:

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

`backend/tests/__init__.py`: create empty file.

- [ ] **Step 3: Install and smoke-test**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && pip install -r requirements-dev.txt`

`backend/tests/test_shopping_locale.py`:

```python
from app.services.shopping_locale import currency_for


def test_currency_for_known_country():
    assert currency_for("az") == "AZN"


def test_currency_for_unknown_country_defaults_usd():
    assert currency_for("zz") == "USD"
```

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -v`
Expected: 2 PASSED.

- [ ] **Step 4: Commit**

```bash
git add backend/requirements-dev.txt backend/pytest.ini backend/tests/
git commit -m "test(backend): add pytest infrastructure"
```

---

### Task 2: Stylist chat LLM call — prompt, parser, `stylist_chat`

The brain: one prompt that understands intent and returns a validated `{reply, chips, action}` envelope.

**Files:**
- Modify: `backend/app/services/llm_service.py` (append at end)
- Test: `backend/tests/test_stylist_chat_llm.py`

**Interfaces:**
- Consumes: existing `_gemini_generate`, `_parse_json`, `LlmError`.
- Produces:
  - `_parse_stylist_chat(raw: str) -> dict[str, Any]` — pure; always returns `{"reply": str, "chips": list[str] | None, "action": dict | None}`. A non-None action is guaranteed to have `"type"` in `("outfit", "shop", "mix")`, `"item_ids"`: `list[str]`, `"search"`: `dict | None` (with `query: str`, `budget_max`, `category` keys when present).
  - `async stylist_chat(wardrobe_json: str, prompt: str, *, history: list[dict[str, str]] | None = None, profile: dict | None = None, city: str | None = None, country: str | None = None) -> dict[str, Any]` — raises `LlmError` on API failure. Task 4 calls this.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_stylist_chat_llm.py`:

```python
import json

from app.services import llm_service
from app.services.llm_service import _parse_stylist_chat, stylist_chat


def test_parse_outfit_action():
    raw = json.dumps({
        "reply": "Let's build it!",
        "chips": ["Try it on", "Something else"],
        "action": {"type": "outfit", "item_ids": ["a-1", "b-2"], "search": None},
    })
    out = _parse_stylist_chat(raw)
    assert out["reply"] == "Let's build it!"
    assert out["chips"] == ["Try it on", "Something else"]
    assert out["action"]["type"] == "outfit"
    assert out["action"]["item_ids"] == ["a-1", "b-2"]


def test_parse_mix_action_with_search():
    raw = json.dumps({
        "reply": "Your blazer + new chinos!",
        "chips": None,
        "action": {
            "type": "mix",
            "item_ids": ["a-1"],
            "search": {"query": "beige chinos", "budget_max": 60, "category": "bottoms"},
        },
    })
    out = _parse_stylist_chat(raw)
    assert out["action"]["type"] == "mix"
    assert out["action"]["search"]["query"] == "beige chinos"


def test_parse_invalid_action_type_becomes_none():
    raw = json.dumps({"reply": "hi", "chips": None, "action": {"type": "dance"}})
    assert _parse_stylist_chat(raw)["action"] is None


def test_parse_chips_capped_at_four_strings():
    raw = json.dumps({"reply": "hi", "chips": ["a", "b", "c", "d", "e", 7], "action": None})
    assert _parse_stylist_chat(raw)["chips"] == ["a", "b", "c", "d"]


def test_parse_garbage_falls_back_to_raw_reply():
    out = _parse_stylist_chat("not json at all")
    assert out["reply"] == "not json at all"
    assert out["action"] is None
    assert out["chips"] is None


async def test_stylist_chat_prompt_assembly(monkeypatch):
    captured = {}

    async def fake_generate(parts, *, json_mode=True, grounded=False):
        captured["text"] = parts[0]["text"]
        return json.dumps({"reply": "ok", "chips": None, "action": None})

    monkeypatch.setattr(llm_service, "_gemini_generate", fake_generate)
    await stylist_chat(
        '[{"id": "a-1", "name": "linen blazer"}]',
        "what should I wear tonight?",
        history=[{"role": "user", "content": "hey"}, {"role": "assistant", "content": "hi!"}],
        profile={"undertone": "warm", "best_colors": ["olive"]},
        city="Baku",
        country="az",
    )
    text = captured["text"]
    assert "linen blazer" in text
    assert "what should I wear tonight?" in text
    assert "User: hey" in text
    assert "Stylist: hi!" in text
    assert "warm" in text and "olive" in text
    assert "Baku" in text
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_stylist_chat_llm.py -v`
Expected: FAIL with `ImportError: cannot import name '_parse_stylist_chat'`

- [ ] **Step 3: Implement prompt, parser, and call**

Append to `backend/app/services/llm_service.py`:

```python
STYLIST_CHAT_SYSTEM = """You are Vesto — the user's personal AI stylist inside the VestoFit app. You ONLY talk about clothing, outfits, and personal style.

Personality: warm, upbeat, encouraging. Celebrate what the user already owns. When a request is vague, ask ONE short clarifying question. If the user drifts off-topic, respond kindly in one sentence and steer back to style — never a cold refusal.

You can take one action per turn:
1. "outfit" — build a look from the user's wardrobe. Pick item ids ONLY from the wardrobe JSON. Valid combos: exactly one dress, OR one top + one bottom, OR two tops + one bottom (second top = outer layer).
2. "shop" — the user wants something they don't own. Provide a store search query.
3. "mix" — combine wardrobe items with one new piece to buy (item_ids + search together).
4. null — just conversation: styling advice, questions, motivation, clarifications.

Use the style profile (if given) to tailor color and silhouette advice. Use the location only to keep shopping suggestions realistic for where the user lives.
If the wardrobe is too small for a request, say so encouragingly and suggest shopping or adding items (chips: ["Find it in stores", "Open wardrobe"]).

Respond ONLY as JSON:
{
  "reply": "<1-3 warm conversational sentences>",
  "chips": ["<1-4 word quick reply>", ...] or null,
  "action": {
    "type": "outfit" | "shop" | "mix",
    "item_ids": ["<wardrobe uuid>", ...] or [],
    "search": {"query": "<store search terms>", "budget_max": <number or null>, "category": "tops|bottoms|dresses" or null} or null
  } or null
}

Rules:
- action is null for pure conversation. Never force an action.
- item_ids must come from the wardrobe JSON. Never invent ids.
- "shop"/"mix" require search.query. budget_max only if the user stated a budget.
- chips: max 4, each 1-4 words, only when a natural next step exists."""


def _parse_stylist_chat(raw: str) -> dict[str, Any]:
    try:
        parsed = _parse_json(raw)
    except LlmError:
        return {"reply": raw, "chips": None, "action": None}

    reply = str(parsed.get("reply") or raw)

    chips = parsed.get("chips")
    if isinstance(chips, list):
        chips = [str(c) for c in chips if isinstance(c, str)][:4] or None
    else:
        chips = None

    action = parsed.get("action")
    if isinstance(action, dict) and action.get("type") in ("outfit", "shop", "mix"):
        raw_ids = action.get("item_ids")
        item_ids = [str(i) for i in raw_ids] if isinstance(raw_ids, list) else []
        search = action.get("search")
        if not isinstance(search, dict) or not str(search.get("query") or "").strip():
            search = None
        action = {"type": action["type"], "item_ids": item_ids, "search": search}
    else:
        action = None

    return {"reply": reply, "chips": chips, "action": action}


async def stylist_chat(
    wardrobe_json: str,
    prompt: str,
    *,
    history: list[dict[str, str]] | None = None,
    profile: dict | None = None,
    city: str | None = None,
    country: str | None = None,
) -> dict[str, Any]:
    sections = [STYLIST_CHAT_SYSTEM, f"Wardrobe:\n{wardrobe_json}"]
    if profile:
        sections.append(f"Style profile:\n{json.dumps(profile, ensure_ascii=False)}")
    location = ", ".join(p for p in (city, country and country.upper()) if p)
    if location:
        sections.append(f"User location: {location}")
    if history:
        lines = []
        for msg in history[-12:]:
            speaker = "Stylist" if msg.get("role") == "assistant" else "User"
            lines.append(f"{speaker}: {msg.get('content', '')}")
        sections.append("Conversation so far:\n" + "\n".join(lines))
    sections.append(f"User: {prompt}")

    raw = await _gemini_generate([{"text": "\n\n".join(sections)}], json_mode=True)
    return _parse_stylist_chat(raw)
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_stylist_chat_llm.py -v`
Expected: 6 PASSED.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/llm_service.py backend/tests/test_stylist_chat_llm.py
git commit -m "feat(stylist): unified chat prompt with outfit/shop/mix action schema"
```

---

### Task 3: Style profile — model, vision analysis, service, endpoints

"Based on their look, offer styles": analyze the avatar photo once into fashion-only attributes, store them, let the user edit/delete.

**Files:**
- Create: `backend/app/models/style_profile.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/services/llm_service.py` (append `analyze_style_photo`)
- Create: `backend/app/services/style_profile_service.py`
- Modify: `backend/app/schemas/stylist.py` (append)
- Modify: `backend/app/routers/stylist.py` (append endpoints)
- Test: `backend/tests/test_style_profile.py`

**Interfaces:**
- Consumes: `Avatar.photo_key`, `get_storage().read_bytes(key)`, `_gemini_generate` (vision via `inline_data`, same pattern as `tag_garment_image`).
- Produces:
  - Model `StyleProfile` (`style_profiles` table: `id`, unique `user_id` FK, `data: JSONB`, `preferences: Text | None`, timestamps). Created automatically by `create_all` on startup — no `db_migrate.py` change needed (new table, not an alteration).
  - `async analyze_style_photo(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict` in llm_service.
  - Service: `async get_profile(db, user_id) -> StyleProfile | None`, `async get_profile_data(db, user_id) -> dict | None` (merges `data` + `preferences`; Task 4 injects this into chat), `async analyze_from_avatar(db, user_id) -> StyleProfile` (raises `StyleProfileError` when no avatar / no person detected), `async update_preferences(db, user_id, preferences) -> StyleProfile`, `async delete_profile(db, user_id) -> None`, exception class `StyleProfileError`.
  - Endpoints: `GET /stylist/profile`, `POST /stylist/profile/analyze`, `PUT /stylist/profile`, `DELETE /stylist/profile` (204).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_style_profile.py`:

```python
import json

import pytest

from app.services import llm_service
from app.services.llm_service import analyze_style_photo

PROFILE_JSON = {
    "undertone": "warm",
    "contrast": "medium",
    "best_colors": ["olive", "cream", "rust"],
    "avoid_colors": ["neon pink"],
    "style_notes": "Structured shoulders and earth tones work well.",
}


async def test_analyze_style_photo_parses_profile(monkeypatch):
    captured = {}

    async def fake_generate(parts, *, json_mode=True, grounded=False):
        captured["parts"] = parts
        return json.dumps(PROFILE_JSON)

    monkeypatch.setattr(llm_service, "_gemini_generate", fake_generate)
    data = await analyze_style_photo(b"fake-image-bytes")
    assert data["undertone"] == "warm"
    assert "olive" in data["best_colors"]
    # vision payload: prompt text + inline image
    assert captured["parts"][1]["inline_data"]["mime_type"] == "image/jpeg"
    # privacy: prompt must forbid identity inference
    assert "age" in captured["parts"][0]["text"].lower()


async def test_analyze_style_photo_no_person(monkeypatch):
    async def fake_generate(parts, *, json_mode=True, grounded=False):
        return json.dumps({"undertone": None})

    monkeypatch.setattr(llm_service, "_gemini_generate", fake_generate)
    data = await analyze_style_photo(b"fake")
    assert data["undertone"] is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_style_profile.py -v`
Expected: FAIL with `ImportError: cannot import name 'analyze_style_photo'`

- [ ] **Step 3: Add the vision analysis to llm_service**

Append to `backend/app/services/llm_service.py`:

```python
STYLE_PROFILE_SYSTEM = """You are a professional color-and-style analyst for a fashion app. Look at the person in the photo and produce FASHION guidance only.

Strict privacy rules: do NOT infer, mention, or encode age, ethnicity, gender identity, or any personal identity attribute. Only visual styling signals (coloring, contrast, proportions as they relate to clothing).

Return ONLY JSON:
{
  "undertone": "warm" | "cool" | "neutral",
  "contrast": "low" | "medium" | "high",
  "best_colors": ["<color name>", ... up to 8],
  "avoid_colors": ["<color name>", ... up to 5],
  "style_notes": "<2-3 sentences of silhouette and styling guidance>"
}
If the image does not clearly show a person, return {"undertone": null}."""


async def analyze_style_photo(
    image_bytes: bytes, mime_type: str = "image/jpeg"
) -> dict[str, Any]:
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    parts = [
        {"text": STYLE_PROFILE_SYSTEM},
        {"inline_data": {"mime_type": mime_type, "data": b64}},
    ]
    raw = await _gemini_generate(parts, json_mode=True)
    return _parse_json(raw)
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_style_profile.py -v`
Expected: 2 PASSED.

- [ ] **Step 5: Create the model**

`backend/app/models/style_profile.py`:

```python
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StyleProfile(Base):
    __tablename__ = "style_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    preferences: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
```

In `backend/app/models/__init__.py`, add the import after the `stylist_message` line and `"StyleProfile"` to `__all__`:

```python
from app.models.style_profile import StyleProfile
```

```python
    "StyleProfile",
```

- [ ] **Step 6: Create the service**

`backend/app/services/style_profile_service.py`:

```python
"""Style profile — fashion-only attributes analyzed from the user's avatar photo."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.avatar import Avatar
from app.models.style_profile import StyleProfile
from app.services.llm_service import LlmError, analyze_style_photo
from app.services.storage import get_storage


class StyleProfileError(RuntimeError):
    pass


async def get_profile(db: AsyncSession, user_id: uuid.UUID) -> StyleProfile | None:
    res = await db.execute(
        select(StyleProfile).where(StyleProfile.user_id == user_id)
    )
    return res.scalar_one_or_none()


async def get_profile_data(db: AsyncSession, user_id: uuid.UUID) -> dict | None:
    profile = await get_profile(db, user_id)
    if profile is None:
        return None
    data = dict(profile.data or {})
    if profile.preferences:
        data["user_preferences"] = profile.preferences
    return data or None


async def analyze_from_avatar(db: AsyncSession, user_id: uuid.UUID) -> StyleProfile:
    res = await db.execute(select(Avatar).where(Avatar.user_id == user_id))
    avatar = res.scalar_one_or_none()
    if avatar is None:
        raise StyleProfileError("Upload an avatar photo first")

    photo = await get_storage().read_bytes(avatar.photo_key)
    try:
        data = await analyze_style_photo(photo)
    except LlmError as e:
        raise StyleProfileError("Analysis failed — try again in a moment") from e
    if not data.get("undertone"):
        raise StyleProfileError("Couldn't read style traits from this photo — try a clearer one")

    profile = await get_profile(db, user_id)
    if profile is None:
        profile = StyleProfile(user_id=user_id, data=data)
        db.add(profile)
    else:
        profile.data = data
    await db.commit()
    await db.refresh(profile)
    return profile


async def update_preferences(
    db: AsyncSession, user_id: uuid.UUID, preferences: str
) -> StyleProfile:
    profile = await get_profile(db, user_id)
    if profile is None:
        profile = StyleProfile(user_id=user_id, data={}, preferences=preferences)
        db.add(profile)
    else:
        profile.preferences = preferences
    await db.commit()
    await db.refresh(profile)
    return profile


async def delete_profile(db: AsyncSession, user_id: uuid.UUID) -> None:
    profile = await get_profile(db, user_id)
    if profile is not None:
        await db.delete(profile)
        await db.commit()
```

- [ ] **Step 7: Add schemas and endpoints**

Append to `backend/app/schemas/stylist.py`:

```python
class StyleProfileResponse(BaseModel):
    data: dict | None = None
    preferences: str | None = None
    updated_at: str | None = None


class StyleProfileUpdateRequest(BaseModel):
    preferences: str = Field(..., max_length=1000)
```

Append to `backend/app/routers/stylist.py` (extend the existing schema import with `StyleProfileResponse, StyleProfileUpdateRequest`):

```python
from app.services.style_profile_service import (
    StyleProfileError,
    analyze_from_avatar,
    delete_profile,
    get_profile,
    update_preferences,
)


def _profile_response(profile) -> StyleProfileResponse:
    if profile is None:
        return StyleProfileResponse()
    return StyleProfileResponse(
        data=profile.data or None,
        preferences=profile.preferences,
        updated_at=profile.updated_at.isoformat() if profile.updated_at else None,
    )


@router.get("/profile", response_model=StyleProfileResponse)
async def read_profile(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    return _profile_response(await get_profile(db, user.id))


@router.post("/profile/analyze", response_model=StyleProfileResponse)
async def analyze_profile(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    try:
        profile = await analyze_from_avatar(db, user.id)
    except StyleProfileError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return _profile_response(profile)


@router.put("/profile", response_model=StyleProfileResponse)
async def edit_profile(
    payload: StyleProfileUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    return _profile_response(await update_preferences(db, user.id, payload.preferences))


@router.delete("/profile", status_code=status.HTTP_204_NO_CONTENT)
async def remove_profile(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    await delete_profile(db, user.id)
```

- [ ] **Step 8: Verify the app imports cleanly and tests still pass**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -c "from app.main import app; print('ok')" && python -m pytest tests -v`
Expected: `ok`, all tests PASSED. (DB paths of the service are exercised live in Task 7 — no test Postgres exists.)

- [ ] **Step 9: Commit**

```bash
git add backend/app/models/style_profile.py backend/app/models/__init__.py backend/app/services/llm_service.py backend/app/services/style_profile_service.py backend/app/schemas/stylist.py backend/app/routers/stylist.py backend/tests/test_style_profile.py
git commit -m "feat(stylist): style profile from avatar photo (fashion-only vision analysis)"
```

---

### Task 4: Chat orchestration — `chat_with_stylist`

Glue: load context, call the LLM, execute the action safely, persist both turns.

**Files:**
- Modify: `backend/app/services/stylist_service.py` (append; also extend the llm_service import)
- Test: `backend/tests/test_chat_with_stylist.py`

**Interfaces:**
- Consumes: `stylist_chat` (Task 2), `get_profile_data` (Task 3), existing `_load_wardrobe`, `_parse_item_ids`, `fetch_owned_items`, `validate_combo`, `create_outfit`, `wardrobe_catalog_json`, `StylistMessage`, `shopping_service.search_products`.
- Produces: `async chat_with_stylist(db: AsyncSession, user: User, prompt: str) -> dict` with keys `reply: str`, `chips: list[str] | None`, `outfit` (Outfit | None), `outfit_item_ids: list[str] | None`, `results` (list[ShoppingResultItem] | None), `search_query: str | None`, `currency: str`, `no_local: bool`. Task 5's router returns this.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_chat_with_stylist.py`:

```python
import json
import uuid
from types import SimpleNamespace

import pytest

import app.services.llm_service as llm
import app.services.shopping_service as shopping
from app.services import stylist_service
from app.services.stylist_service import chat_with_stylist


class FakeDB:
    def __init__(self):
        self.added = []

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        pass


USER = SimpleNamespace(
    id=uuid.uuid4(), country="az", city="Baku", lat=40.4, lng=49.8
)
ITEM_A = uuid.uuid4()
ITEM_B = uuid.uuid4()


@pytest.fixture
def base(monkeypatch):
    async def fake_wardrobe(db, user_id):
        return [
            SimpleNamespace(id=ITEM_A, category="tops", name="linen shirt",
                            color="white", pattern="solid", formality="casual",
                            season="summer", warmth=1, user_notes=None,
                            conditions=None, is_favorite=False),
            SimpleNamespace(id=ITEM_B, category="bottoms", name="chinos",
                            color="beige", pattern="solid", formality="casual",
                            season="all", warmth=2, user_notes=None,
                            conditions=None, is_favorite=False),
        ]

    async def fake_history(db, user_id, limit=12):
        return [{"role": "user", "content": "hey"}]

    async def fake_profile(db, user_id):
        return {"undertone": "warm"}

    monkeypatch.setattr(stylist_service, "_load_wardrobe", fake_wardrobe)
    monkeypatch.setattr(stylist_service, "_recent_history", fake_history)
    monkeypatch.setattr(stylist_service, "_load_profile_data", fake_profile)


def llm_reply(action):
    async def fake_chat(catalog, prompt, **kwargs):
        return {"reply": "Here you go!", "chips": ["Try it on"], "action": action}
    return fake_chat


async def test_pure_conversation_no_action(base, monkeypatch):
    monkeypatch.setattr(llm, "stylist_chat", llm_reply(None))
    db = FakeDB()
    out = await chat_with_stylist(db, USER, "what colors suit me?")
    assert out["reply"] == "Here you go!"
    assert out["outfit"] is None and out["results"] is None
    # both turns persisted
    assert [m.role for m in db.added] == ["user", "assistant"]


async def test_outfit_action_creates_outfit(base, monkeypatch):
    monkeypatch.setattr(
        llm, "stylist_chat",
        llm_reply({"type": "outfit", "item_ids": [str(ITEM_A), str(ITEM_B)], "search": None}),
    )

    async def fake_fetch(db, user_id, ids):
        return [SimpleNamespace(id=i) for i in ids]

    created = {}

    async def fake_create(db, user_id, ids, **kwargs):
        created["ids"] = ids
        return SimpleNamespace(id=uuid.uuid4(), item_ids=ids)

    monkeypatch.setattr(stylist_service, "fetch_owned_items", fake_fetch)
    monkeypatch.setattr(stylist_service, "validate_combo", lambda items: None)
    monkeypatch.setattr(stylist_service, "create_outfit", fake_create)

    db = FakeDB()
    out = await chat_with_stylist(db, USER, "dress me for a picnic")
    assert out["outfit"] is not None
    assert created["ids"] == [ITEM_A, ITEM_B]
    assert out["outfit_item_ids"] == [str(ITEM_A), str(ITEM_B)]
    # assistant message linked to the outfit
    assert db.added[1].outfit_id == out["outfit"].id


async def test_shop_action_searches_with_user_location(base, monkeypatch):
    monkeypatch.setattr(
        llm, "stylist_chat",
        llm_reply({"type": "shop", "item_ids": [],
                   "search": {"query": "denim jacket", "budget_max": 80, "category": "tops"}}),
    )
    captured = {}

    async def fake_search(**kwargs):
        captured.update(kwargs)
        return {"results": ["r1"], "currency": "AZN", "no_local": False}

    monkeypatch.setattr(shopping, "search_products", fake_search)
    db = FakeDB()
    out = await chat_with_stylist(db, USER, "find me a denim jacket")
    assert captured["query"] == "denim jacket"
    assert captured["city"] == "Baku" and captured["country"] == "az"
    assert out["results"] == ["r1"]
    assert out["currency"] == "AZN"
    assert out["search_query"] == "denim jacket"


async def test_invalid_combo_degrades_to_reply(base, monkeypatch):
    from app.services.outfit_service import OutfitValidationError

    monkeypatch.setattr(
        llm, "stylist_chat",
        llm_reply({"type": "outfit", "item_ids": [str(ITEM_A)], "search": None}),
    )

    async def fake_fetch(db, user_id, ids):
        raise OutfitValidationError("nope")

    monkeypatch.setattr(stylist_service, "fetch_owned_items", fake_fetch)
    db = FakeDB()
    out = await chat_with_stylist(db, USER, "dress me")
    assert out["outfit"] is None
    assert "combo" in out["reply"]  # friendly fallback appended
    assert len(db.added) == 2  # conversation still persisted


async def test_llm_failure_returns_friendly_reply(base, monkeypatch):
    from app.services.llm_service import LlmError

    async def boom(catalog, prompt, **kwargs):
        raise LlmError("down")

    monkeypatch.setattr(llm, "stylist_chat", boom)
    db = FakeDB()
    out = await chat_with_stylist(db, USER, "hi")
    assert "moment" in out["reply"]
    assert out["chips"] == ["Try again"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_chat_with_stylist.py -v`
Expected: FAIL with `ImportError: cannot import name 'chat_with_stylist'`

- [ ] **Step 3: Implement the orchestrator**

Append to `backend/app/services/stylist_service.py`:

```python
async def _recent_history(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 12
) -> list[dict[str, str]]:
    res = await db.execute(
        select(StylistMessage)
        .where(StylistMessage.user_id == user_id)
        .order_by(StylistMessage.created_at.desc())
        .limit(limit)
    )
    rows = list(res.scalars().all())
    return [{"role": m.role, "content": m.content} for m in reversed(rows)]


async def _load_profile_data(db: AsyncSession, user_id: uuid.UUID) -> dict | None:
    from app.services.style_profile_service import get_profile_data

    return await get_profile_data(db, user_id)


async def chat_with_stylist(db: AsyncSession, user, prompt: str) -> dict:
    import app.services.llm_service as llm
    import app.services.shopping_service as shopping

    wardrobe = await _load_wardrobe(db, user.id)
    catalog = wardrobe_catalog_json(wardrobe)
    profile = await _load_profile_data(db, user.id)
    history = await _recent_history(db, user.id)

    try:
        parsed = await llm.stylist_chat(
            catalog,
            prompt,
            history=history,
            profile=profile,
            city=user.city,
            country=user.country,
        )
    except LlmError:
        parsed = {
            "reply": "I'm having trouble thinking right now — give me a moment and try again.",
            "chips": ["Try again"],
            "action": None,
        }

    reply: str = parsed["reply"]
    chips = parsed["chips"]
    action = parsed["action"] or {}
    action_type = action.get("type")

    outfit = None
    outfit_item_ids: list[str] | None = None
    results = None
    search_query = None
    currency = "USD"
    no_local = False

    if action_type in ("outfit", "mix"):
        ids = _parse_item_ids(action.get("item_ids") or [])
        if ids:
            try:
                items = await fetch_owned_items(db, user.id, ids)
                validate_combo(items)
                outfit = await create_outfit(
                    db,
                    user.id,
                    [i.id for i in items],
                    source="llm",
                    prompt=prompt,
                    reasoning=reply,
                )
                outfit_item_ids = [str(i.id) for i in items]
            except OutfitValidationError:
                reply += " Hmm, I couldn't finalize that exact combo from your closet — want me to try another one?"
                chips = chips or ["Try again"]

    if action_type in ("shop", "mix"):
        search = action.get("search") or {}
        query = str(search.get("query") or "").strip()
        if query:
            search_query = query
            budget_max = search.get("budget_max")
            budget_max = (
                float(budget_max)
                if isinstance(budget_max, (int, float)) and budget_max > 0
                else None
            )
            category = search.get("category")
            if category not in ("tops", "bottoms", "dresses"):
                category = None
            product_result = await shopping.search_products(
                query=query,
                budget_max=budget_max,
                category=category,
                country=user.country,
                city=user.city,
                lat=user.lat,
                lng=user.lng,
            )
            results = product_result["results"]
            currency = product_result["currency"]
            no_local = product_result["no_local"]

    db.add(StylistMessage(user_id=user.id, role="user", content=prompt))
    db.add(
        StylistMessage(
            user_id=user.id,
            role="assistant",
            content=reply,
            outfit_id=outfit.id if outfit else None,
        )
    )
    await db.commit()

    return {
        "reply": reply,
        "chips": chips,
        "outfit": outfit,
        "outfit_item_ids": outfit_item_ids,
        "results": results,
        "search_query": search_query,
        "currency": currency,
        "no_local": no_local,
    }
```

Note: `select` is already imported at the top of the file. Module-level access (`llm.stylist_chat`, `shopping.search_products`) keeps monkeypatching effective.

- [ ] **Step 4: Run tests to verify pass**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_chat_with_stylist.py -v`
Expected: 5 PASSED.

- [ ] **Step 5: Run the full suite**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -v`
Expected: all PASSED.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/stylist_service.py backend/tests/test_chat_with_stylist.py
git commit -m "feat(stylist): chat orchestrator with memory, outfit/shop/mix action execution"
```

---

### Task 5: `POST /stylist/chat` endpoint

**Files:**
- Modify: `backend/app/schemas/stylist.py` (append)
- Modify: `backend/app/routers/stylist.py` (append)

**Interfaces:**
- Consumes: `chat_with_stylist` (Task 4), `ShoppingResultItem` schema.
- Produces: `POST /stylist/chat` → `StylistChatResponse {reply, chips, outfit_id, outfit_item_ids, results, search_query, currency, no_local}`. Frontend Task 6 calls this.

- [ ] **Step 1: Add schemas**

Append to `backend/app/schemas/stylist.py` (add `from app.schemas.shopping import ShoppingResultItem` to the imports):

```python
class StylistChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)


class StylistChatResponse(BaseModel):
    reply: str
    chips: list[str] | None = None
    outfit_id: str | None = None
    outfit_item_ids: list[str] | None = None
    results: list[ShoppingResultItem] | None = None
    search_query: str | None = None
    currency: str = "USD"
    no_local: bool = False
```

- [ ] **Step 2: Add the endpoint**

Append to `backend/app/routers/stylist.py` (extend the schema import with `StylistChatRequest, StylistChatResponse`; extend the service import with `chat_with_stylist`):

```python
@router.post("/chat", response_model=StylistChatResponse)
async def chat(
    payload: StylistChatRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    out = await chat_with_stylist(db, user, payload.prompt)
    return StylistChatResponse(
        reply=out["reply"],
        chips=out["chips"],
        outfit_id=str(out["outfit"].id) if out["outfit"] else None,
        outfit_item_ids=out["outfit_item_ids"],
        results=out["results"],
        search_query=out["search_query"],
        currency=out["currency"],
        no_local=out["no_local"],
    )
```

- [ ] **Step 3: Verify app boots and OpenAPI includes the route**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -c "from app.main import app; assert any(getattr(r, 'path', '') == '/stylist/chat' for r in app.routes); print('route ok')"`
Expected: `route ok`

- [ ] **Step 4: Run the full suite**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -v`
Expected: all PASSED.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/stylist.py backend/app/routers/stylist.py
git commit -m "feat(stylist): POST /stylist/chat unified endpoint"
```

---

### Task 6: Frontend — unified chat + style profile section

Switch stylist mode to `/stylist/chat`, render chips and inline shop results, drop the regex intent hack; add a Style Profile card in Settings.

**Files:**
- Modify: `frontend/src/lib/api.ts` (types + methods)
- Modify: `frontend/src/components/StylistChat.tsx`
- Create: `frontend/src/components/settings/StyleProfileSection.tsx`
- Modify: `frontend/src/app/settings/page.tsx` (render new section after `<LocationSection />`, line 50)

**Interfaces:**
- Consumes: `POST /stylist/chat`, `GET/POST/PUT/DELETE /stylist/profile` (Tasks 3+5).
- Produces: `api.stylistChat(prompt)`, `api.styleProfile()`, `api.analyzeStyleProfile()`, `api.updateStyleProfile(preferences)`, `api.deleteStyleProfile()`; `StylistChatResult` and `StyleProfileData` types.

- [ ] **Step 1: Add API types and methods**

In `frontend/src/lib/api.ts`, add after the `ShoppingHistoryItem` type (line ~121):

```typescript
export type StylistChatResult = {
  reply: string;
  chips?: string[] | null;
  outfit_id?: string | null;
  outfit_item_ids?: string[] | null;
  results?: ShoppingResultItem[] | null;
  search_query?: string | null;
  currency?: string;
  no_local?: boolean;
};

export type StyleProfileData = {
  data?: {
    undertone?: string | null;
    contrast?: string | null;
    best_colors?: string[];
    avoid_colors?: string[];
    style_notes?: string;
    user_preferences?: string;
  } | null;
  preferences?: string | null;
  updated_at?: string | null;
};
```

Add to the `api` object after `stylistMessages()` (line ~333):

```typescript
  stylistChat(prompt: string) {
    return request<StylistChatResult>("/stylist/chat", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
  },
  styleProfile() {
    return request<StyleProfileData>("/stylist/profile");
  },
  analyzeStyleProfile() {
    return request<StyleProfileData>("/stylist/profile/analyze", { method: "POST" });
  },
  updateStyleProfile(preferences: string) {
    return request<StyleProfileData>("/stylist/profile", {
      method: "PUT",
      body: JSON.stringify({ preferences }),
    });
  },
  deleteStyleProfile() {
    return request<void>("/stylist/profile", { method: "DELETE" });
  },
```

- [ ] **Step 2: Rewire StylistChat stylist mode**

In `frontend/src/components/StylistChat.tsx`:

1. Delete the `SHOP_KEYWORDS` constant (line 18).
2. Extend `ChatMessage` with inline results:

```typescript
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  chips?: string[];
  searchTriggered?: boolean;
  shopQuery?: string;
  results?: ShoppingResultItem[];
  currency?: string;
};
```

3. Replace the `mode === "stylist"` branch of `handleSend` (currently lines 119-132):

```typescript
      if (mode === "stylist") {
        const res = await api.stylistChat(text);
        clearTimeout(timer);
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: res.reply,
          chips: res.chips?.slice(0, 4) ?? undefined,
          results: res.results ?? undefined,
          currency: res.currency,
          shopQuery: res.search_query ?? undefined,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        onSuggestion?.(res.reply);
        if (res.outfit_id) {
          onStylistResult?.({
            reasoning: res.reply,
            item_ids: res.outfit_item_ids ?? [],
            outfit_id: res.outfit_id,
            decline: false,
          });
        }
        if (res.results && onSearchResults) {
          onSearchResults(res.results, res.currency, res.no_local, undefined);
        }
      } else {
```

4. Add an inline results strip inside the message bubble block. In the messages `map`, after the `msg.shopQuery` button block (after line ~304), insert:

```tsx
                {msg.results && msg.results.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto pb-1 max-w-md">
                    {msg.results.slice(0, 6).map((r, i) => (
                      <a
                        key={i}
                        href={r.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 w-28 rounded-xl3 border border-line bg-surface2 overflow-hidden hover:border-coral transition-colors"
                      >
                        <div className="aspect-[3/4] bg-surface2">
                          {r.image_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.image_url} alt={r.title} className="w-full h-full object-cover" />
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className="text-[10px] leading-tight line-clamp-2">{r.title}</p>
                          <p className="text-[10px] font-bold text-coral mt-0.5">
                            {r.price != null ? `${r.approx ? "~" : ""}${msg.currency || "USD"} ${r.price.toFixed(0)}` : r.source}
                          </p>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
```

(`approx` exists on `ShoppingResultItem` only if the grounded-shopping plan ran; if the field is absent, drop `${r.approx ? "~" : ""}`.)

5. The existing `shopQuery` "Shop these →" button now uses the LLM-provided `search_query` instead of regex — no change needed to its JSX.

- [ ] **Step 3: Create the settings Style Profile section**

`frontend/src/components/settings/StyleProfileSection.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { api, type StyleProfileData } from "@/lib/api";
import { useToast } from "@/components/Toast";

export default function StyleProfileSection() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<StyleProfileData | null>(null);
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState("");

  useEffect(() => {
    api.styleProfile().then((p) => {
      setProfile(p);
      setPrefs(p.preferences || "");
    }).catch(() => {});
  }, []);

  async function analyze() {
    setBusy(true);
    try {
      const p = await api.analyzeStyleProfile();
      setProfile(p);
      toast("success", "Style profile updated");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Analysis failed");
    }
    setBusy(false);
  }

  async function savePrefs() {
    setBusy(true);
    try {
      const p = await api.updateStyleProfile(prefs);
      setProfile(p);
      toast("success", "Preferences saved");
    } catch {
      toast("error", "Couldn't save preferences");
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    try {
      await api.deleteStyleProfile();
      setProfile(null);
      setPrefs("");
      toast("success", "Style profile deleted");
    } catch {
      toast("error", "Couldn't delete profile");
    }
    setBusy(false);
  }

  const d = profile?.data;

  return (
    <div className="card p-6 space-y-4">
      <h2 className="font-bold text-ink">Style profile</h2>
      <p className="text-sm text-muted">
        Let your stylist analyze your avatar photo for color and silhouette guidance.
        Fashion traits only — you can delete this anytime.
      </p>

      {d?.undertone && (
        <div className="text-sm space-y-1">
          <p><span className="font-semibold">Undertone:</span> {d.undertone} · <span className="font-semibold">Contrast:</span> {d.contrast}</p>
          {d.best_colors && d.best_colors.length > 0 && (
            <p><span className="font-semibold">Best colors:</span> {d.best_colors.join(", ")}</p>
          )}
          {d.style_notes && <p className="text-muted">{d.style_notes}</p>}
        </div>
      )}

      <textarea
        value={prefs}
        onChange={(e) => setPrefs(e.target.value)}
        placeholder="Your style preferences (e.g. minimalist, no bright colors, modest fits)…"
        maxLength={1000}
        rows={2}
        className="field-sm w-full"
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={analyze} disabled={busy} className="btn-primary px-4 py-2 text-sm">
          {d?.undertone ? "Re-analyze my look" : "Analyze my look"}
        </button>
        <button type="button" onClick={savePrefs} disabled={busy} className="btn-secondary px-4 py-2 text-sm">
          Save preferences
        </button>
        {(d?.undertone || profile?.preferences) && (
          <button type="button" onClick={remove} disabled={busy} className="text-sm text-muted hover:text-coral transition-colors px-2">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
```

(If `btn-secondary` doesn't exist in `globals.css`, use `chip` instead — check with grep before finalizing.)

In `frontend/src/app/settings/page.tsx`: add `import StyleProfileSection from "@/components/settings/StyleProfileSection";` to the imports, and render `<StyleProfileSection />` on a new line directly after `<LocationSection />` (line 50).

- [ ] **Step 4: Typecheck and lint**

Run: `cd C:/Users/Envy/Desktop/VTO/frontend && npx tsc --noEmit && npm run lint`
Expected: no type errors, lint clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/components/StylistChat.tsx frontend/src/components/settings/StyleProfileSection.tsx frontend/src/app/settings/page.tsx
git commit -m "feat(stylist): unified chat UI with inline shop results + style profile settings"
```

---

### Task 7: Live end-to-end verification

Requires running Postgres (docker compose) and real `GEMINI_API_KEY` in `backend/.env`.

**Files:**
- No source changes; fixes discovered get their own commits.

- [ ] **Step 1: Boot the stack**

Run: `cd C:/Users/Envy/Desktop/VTO && docker compose up -d db && cd backend && uvicorn app.main:app --reload` (separate terminal: `cd frontend && npm run dev`)
Expected: startup creates the `style_profiles` table (create_all); no errors.

- [ ] **Step 2: Exercise each conversation path in the UI** (login with a test account that has 2+ wardrobe items and an avatar)

On `http://localhost:3000` home chat, verify each:

1. **General styling Q** — "What colors go with olive green?" → conversational reply, no outfit created, chips may appear.
2. **Wardrobe outfit** — "Build me a casual look from my closet" → reply + outfit appears via `onStylistResult` (silhouette preview updates), `stylist_messages` rows written.
3. **Shop** — "Find me a denim jacket under 80" → reply + inline product strip in chat.
4. **Mix** — "Use my white shirt and find matching pants to buy" → outfit or item pick + inline shop results together.
5. **Memory** — follow up with "make it warmer" with no other context → reply references the prior look (history is being read).
6. **Off-topic** — "Help me with my math homework" → friendly one-line redirect to style, no action.

- [ ] **Step 3: Style profile flow**

In Settings: click "Analyze my look" → traits render; save a preference ("minimalist, earth tones"); back in chat ask "What suits me?" → reply references profile traits. Delete profile → chat no longer references them.

- [ ] **Step 4: Regression check on old surfaces**

- Shop page (`/shop`) chat still works (`/shopping/ask` untouched).
- Studio reroll still works (`/stylist/reroll` untouched).

- [ ] **Step 5: Commit any fixes**

```bash
git add -A backend/app frontend/src
git commit -m "fix(stylist): unified chat follow-ups from live verification"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** motivating chatbot persona (Task 2 prompt), outfit from wardrobe (Tasks 2+4), find clothes in stores (Tasks 2+4 via `search_products` — local coverage improves further once the grounded-shopping plan lands, but this plan works standalone), mix of both (`mix` action), general styling Q&A (`action: null` path + memory), look-based advice (Task 3 profile injected in Task 4), "make sure they work right" (unit tests Tasks 2-4 + live matrix Task 7).
- **Deliberate scope cuts:** `/stylist/suggest`, `/reroll`, `/ask`, `/shopping/ask` left in place (studio + shop page depend on them; consolidation is a follow-up once `/chat` is proven). Shop-page chat not migrated. Shopping results not persisted to history (ephemeral by design).
- **Privacy:** vision prompt forbids identity attributes; analysis is opt-in (user clicks), re-runnable, deletable; tested in `test_analyze_style_photo_parses_profile`.
- **Type consistency check:** `stylist_chat` kwargs (Task 2 def vs Task 4 call: `history, profile, city, country`) match; `chat_with_stylist` return keys match router mapping (Task 5) and `StylistChatResult` type (Task 6); parser action shape (`type/item_ids/search`) matches orchestrator reads; `StyleProfileError` raised in service, caught in router.
- **Testing honesty:** DB-touching paths (`style_profile_service`, `_recent_history`, message persistence against real Postgres) have no test database — they are covered by the Task 7 live matrix instead; pure logic and orchestration are unit-tested with fakes.
