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
