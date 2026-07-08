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
