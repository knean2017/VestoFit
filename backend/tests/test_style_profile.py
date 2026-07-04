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
