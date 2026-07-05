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


async def test_rate_limited_llm_gets_honest_fallback(base, monkeypatch):
    from app.services.llm_service import LlmError

    async def busy(catalog, prompt, **kwargs):
        raise LlmError("Gemini error (429): quota", status_code=429)

    monkeypatch.setattr(llm, "stylist_chat", busy)
    db = FakeDB()
    out = await chat_with_stylist(db, USER, "hi")
    assert "a lot of requests" in out["reply"]
    assert out["chips"] == ["Try again"]
