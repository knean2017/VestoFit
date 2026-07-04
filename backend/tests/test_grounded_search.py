import pytest

from app.services import llm_service
from app.services.llm_service import _parse_grounded_products, grounded_product_search

VALID_ITEM = {
    "title": "Yellow Midi Dress",
    "price": 79.9,
    "currency": "AZN",
    "store": "Birmarket",
    "product_url": "https://birmarket.az/p/yellow-midi-dress",
    "image_url": "https://birmarket.az/img/dress.jpg",
}


def test_parse_valid_array():
    import json
    items = _parse_grounded_products(json.dumps([VALID_ITEM]))
    assert len(items) == 1
    assert items[0]["title"] == "Yellow Midi Dress"
    assert items[0]["price"] == 79.9
    assert items[0]["store"] == "Birmarket"


def test_parse_strips_code_fences_and_prose():
    raw = 'Here are the results:\n```json\n[' + \
        '{"title": "Tee", "price": 12, "currency": "AZN", "store": "Umico",' + \
        ' "product_url": "https://umico.az/p/tee", "image_url": ""}]\n```'
    items = _parse_grounded_products(raw)
    assert len(items) == 1
    assert items[0]["price"] == 12.0


def test_parse_drops_invalid_items():
    import json
    bad = [
        {**VALID_ITEM, "price": None},            # no price
        {**VALID_ITEM, "price": 0},               # non-positive price
        {**VALID_ITEM, "title": ""},              # no title
        {**VALID_ITEM, "product_url": "ftp://x"}, # not http(s)
        "not-a-dict",
    ]
    assert _parse_grounded_products(json.dumps(bad)) == []


def test_parse_caps_at_eight_items():
    import json
    many = [dict(VALID_ITEM, title=f"Item {i}") for i in range(12)]
    assert len(_parse_grounded_products(json.dumps(many))) == 8


def test_parse_garbage_returns_empty():
    assert _parse_grounded_products("I could not find anything, sorry!") == []


async def test_gemini_generate_retries_on_503(monkeypatch):
    import json

    attempts = {"count": 0}

    class FakeResponse:
        def __init__(self, status_code, payload):
            self.status_code = status_code
            self._payload = payload
            self.text = json.dumps(payload)

        def json(self):
            return self._payload

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, **kwargs):
            attempts["count"] += 1
            if attempts["count"] < 3:
                return FakeResponse(503, {"error": {"code": 503, "status": "UNAVAILABLE"}})
            return FakeResponse(
                200,
                {"candidates": [{"content": {"parts": [{"text": "ok"}]}}]},
            )

    monkeypatch.setattr(llm_service.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(llm_service._settings, "gemini_api_key", "test-key")

    async def no_sleep(_seconds):
        return None

    monkeypatch.setattr(llm_service.asyncio, "sleep", no_sleep)

    result = await llm_service._gemini_generate([{"text": "hi"}], json_mode=False)
    assert result == "ok"
    assert attempts["count"] == 3


async def test_grounded_product_search_calls_gemini(monkeypatch):
    captured = {}

    async def fake_generate(parts, *, json_mode=True, grounded=False):
        captured["prompt"] = parts[0]["text"]
        captured["grounded"] = grounded
        captured["json_mode"] = json_mode
        import json
        return json.dumps([VALID_ITEM])

    monkeypatch.setattr(llm_service, "_gemini_generate", fake_generate)
    items = await grounded_product_search(
        "yellow summer dress",
        country="az",
        city="Baku",
        currency="AZN",
        budget_max=100,
        retailers=["birmarket.az", "trendyol.com"],
    )
    assert captured["grounded"] is True
    assert captured["json_mode"] is False
    assert "yellow summer dress" in captured["prompt"]
    assert "Baku" in captured["prompt"]
    assert "birmarket.az" in captured["prompt"]
    assert "100" in captured["prompt"]
    assert items == [VALID_ITEM | {"price": 79.9}]
