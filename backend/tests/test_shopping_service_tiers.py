import pytest

from app.config import get_settings
from app.schemas.shopping import ShoppingResultItem
from app.services import shopping_service

GROUNDED_RAW = [
    {
        "title": "Yellow Midi Dress",
        "price": 79.9,
        "currency": "AZN",
        "store": "Birmarket",
        "product_url": "https://birmarket.az/p/yellow-midi-dress",
        "image_url": "",
    },
    {
        "title": "Pricey Gown",
        "price": 500.0,
        "currency": "AZN",
        "store": "Boutique",
        "product_url": "https://example.az/p/gown",
        "image_url": "",
    },
]


@pytest.fixture
def keys(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "serpapi_key", "test-serpapi-key")
    monkeypatch.setattr(settings, "gemini_api_key", "test-gemini-key")
    return settings


@pytest.fixture
def fake_grounded(monkeypatch):
    calls = {"count": 0, "kwargs": None}

    async def fake(query, **kwargs):
        calls["count"] += 1
        calls["kwargs"] = kwargs
        return list(GROUNDED_RAW)

    import app.services.llm_service as llm
    monkeypatch.setattr(llm, "grounded_product_search", fake)
    return calls


@pytest.fixture
def empty_serpapi(monkeypatch):
    async def fake_products(*args, **kwargs):
        return []

    async def fake_stores(*args, **kwargs):
        return []

    monkeypatch.setattr(shopping_service, "_search_serpapi", fake_products)
    monkeypatch.setattr(shopping_service, "_search_local_stores", fake_stores)


async def test_unsupported_country_falls_back_to_grounded(keys, fake_grounded, empty_serpapi):
    result = await shopping_service.search_products(
        "yellow summer dress", country="az", city="Baku"
    )
    assert fake_grounded["count"] == 1
    assert fake_grounded["kwargs"]["country"] == "az"
    assert fake_grounded["kwargs"]["currency"] == "AZN"
    assert fake_grounded["kwargs"]["retailers"]  # az registry injected
    products = [r for r in result["results"] if r.kind == "product"]
    assert len(products) == 2
    assert all(p.approx for p in products)
    assert result["no_local"] is False
    assert result["currency"] == "AZN"


async def test_grounded_respects_budget(keys, fake_grounded, empty_serpapi):
    result = await shopping_service.search_products(
        "dress", budget_max=100.0, country="az", city="Baku"
    )
    titles = [r.title for r in result["results"]]
    assert "Yellow Midi Dress" in titles
    assert "Pricey Gown" not in titles


async def test_tier1_results_skip_grounded(keys, fake_grounded, monkeypatch):
    tier1_item = ShoppingResultItem(
        title="Zara Dress", price=49.0, currency="USD",
        image_url="", product_url="https://zara.com/p/1", source="Zara",
    )

    async def fake_products(*args, **kwargs):
        return [tier1_item]

    async def fake_stores(*args, **kwargs):
        return []

    monkeypatch.setattr(shopping_service, "_search_serpapi", fake_products)
    monkeypatch.setattr(shopping_service, "_search_local_stores", fake_stores)

    result = await shopping_service.search_products("dress", country="us", city="Boston")
    assert fake_grounded["count"] == 0
    assert result["results"][0].approx is False


async def test_grounded_failure_degrades_gracefully(keys, empty_serpapi, monkeypatch):
    from app.services.llm_service import LlmError
    import app.services.llm_service as llm

    async def boom(query, **kwargs):
        raise LlmError("gemini down")

    monkeypatch.setattr(llm, "grounded_product_search", boom)
    result = await shopping_service.search_products("dress", country="az", city="Baku")
    assert result["results"] == []
    assert result["no_local"] is True
