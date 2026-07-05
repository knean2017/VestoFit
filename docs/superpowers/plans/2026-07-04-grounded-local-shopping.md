# Grounded Local Shopping Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every user priced, purchasable product results — even in countries Google Shopping does not cover (Azerbaijan, Central Asia, etc.) — via a tiered fallback that uses Gemini's Google Search grounding.

**Architecture:** Three-tier search in `shopping_service.search_products`. Tier 1: existing SerpAPI `google_shopping` (unchanged, runs where supported). Tier 2 (new): when Tier 1 yields zero products, call Gemini 2.5 Flash-Lite with the `google_search` grounding tool; the model searches local retailers (hinted by a small per-country registry), and returns structured product JSON (title/price/currency/store/url). Tier 3: existing SerpAPI `google_local` physical-store lane (unchanged, merged in). Grounded prices are flagged `approx=True` end-to-end and rendered with a `~` prefix in the UI.

**Tech Stack:** FastAPI, httpx, Gemini REST API (`generativelanguage.googleapis.com`, `tools: [{"google_search": {}}]`), pydantic v2, pytest + pytest-asyncio (new dev deps), Next.js 15 / React 19 frontend.

## Global Constraints

- LLM model stays `gemini-2.5-flash-lite` (from `Settings.llm_model`); it supports the `google_search` grounding tool.
- Grounding tool is **incompatible with `responseMimeType: application/json`** — grounded calls must use plain-text mode and parse JSON out of the reply.
- No new env vars or API keys. Tier 2 is gated on the existing `settings.gemini_api_key`.
- Never invent products: parser drops any item missing a title, a positive numeric price, or an `http(s)` product URL. Cap 8 items.
- Existing behavior must not change for supported countries with results, nor for the no-key mock path.
- Backend tests run from `backend/`: `python -m pytest tests -v`.
- Python backend files use 4-space indent, `from __future__` not used; match existing import style (stdlib, blank line, `app.` imports).

---

### Task 1: Backend test infrastructure + locale smoke test

The backend has no test setup. Add pytest + pytest-asyncio and a first real test against `shopping_locale` so the harness is proven.

**Files:**
- Create: `backend/requirements-dev.txt`
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py` (empty)
- Test: `backend/tests/test_shopping_locale.py`

**Interfaces:**
- Consumes: `app.services.shopping_locale.currency_for`, `locale_for` (existing).
- Produces: working `python -m pytest tests -v` invocation from `backend/`; later tasks add tests under `backend/tests/`.

- [ ] **Step 1: Create dev requirements and pytest config**

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

- [ ] **Step 2: Install dev deps**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && pip install -r requirements-dev.txt`
Expected: pytest and pytest-asyncio installed without errors.

- [ ] **Step 3: Write the locale tests**

`backend/tests/test_shopping_locale.py`:

```python
from app.services.shopping_locale import currency_for, locale_for


def test_currency_for_known_country():
    assert currency_for("az") == "AZN"
    assert currency_for("us") == "USD"


def test_currency_for_unknown_country_defaults_usd():
    assert currency_for("zz") == "USD"


def test_locale_for_supported_country():
    locale = locale_for("de")
    assert locale is not None
    assert locale["gl"] == "de"


def test_locale_for_unsupported_country_returns_none():
    assert locale_for("az") is None
```

- [ ] **Step 4: Run tests, verify pass**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -v`
Expected: 4 PASSED. (These pass immediately — this task validates infrastructure, not new behavior.)

- [ ] **Step 5: Commit**

```bash
git add backend/requirements-dev.txt backend/pytest.ini backend/tests/
git commit -m "test(backend): add pytest infrastructure + shopping locale tests"
```

---

### Task 2: Per-country local retailer registry

Small curated map of local retail domains per unsupported country, injected later into the grounding prompt as "prefer these sites". Starts with Azerbaijan; grows over time.

**Files:**
- Modify: `backend/app/services/shopping_locale.py` (append after `currency_for`, ~line 143)
- Test: `backend/tests/test_shopping_locale.py` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces: `retailers_for(country: str) -> list[str]` — lowercase ISO-3166 alpha-2 in, list of retail domains out, `[]` for unknown countries. Task 3's `grounded_product_search` takes this list as its `retailers` kwarg.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_shopping_locale.py`:

```python
from app.services.shopping_locale import retailers_for


def test_retailers_for_azerbaijan():
    domains = retailers_for("az")
    assert "birmarket.az" in domains
    assert "trendyol.com" in domains


def test_retailers_for_unknown_country_returns_empty():
    assert retailers_for("zz") == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_shopping_locale.py -v`
Expected: FAIL with `ImportError: cannot import name 'retailers_for'`

- [ ] **Step 3: Implement the registry**

Append to `backend/app/services/shopping_locale.py`:

```python
# Curated local retail domains for countries google_shopping does not cover.
# Injected into the grounded-search prompt as "prefer these sites". Grow over time.
LOCAL_RETAILERS: dict[str, list[str]] = {
    "az": ["birmarket.az", "umico.az", "trendyol.com", "geyin.az", "ubuy.az"],
}


def retailers_for(country: str) -> list[str]:
    """Return preferred local retail domains for a country, or [] if none curated."""
    return LOCAL_RETAILERS.get(country, [])
```

- [ ] **Step 4: Run tests to verify pass**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_shopping_locale.py -v`
Expected: 6 PASSED.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/shopping_locale.py backend/tests/test_shopping_locale.py
git commit -m "feat(shopping): per-country local retailer registry"
```

---

### Task 3: Grounded product search in llm_service

Add the Gemini google_search-grounded call: a `grounded` flag on `_gemini_generate`, a strict pure parser, and the public `grounded_product_search` coroutine.

**Files:**
- Modify: `backend/app/services/llm_service.py` (`_gemini_generate` at lines 33-56; new code appended at end of file)
- Test: `backend/tests/test_grounded_search.py`

**Interfaces:**
- Consumes: existing `_gemini_generate`, `LlmError`, `_settings`.
- Produces:
  - `_gemini_generate(parts, *, json_mode=True, grounded=False)` — when `grounded=True`, adds `body["tools"] = [{"google_search": {}}]` and never sets `responseMimeType`.
  - `_parse_grounded_products(raw: str) -> list[dict[str, Any]]` — pure; each dict has exactly keys `title: str`, `price: float`, `currency: str`, `store: str`, `product_url: str`, `image_url: str`.
  - `async grounded_product_search(query: str, *, country: str | None = None, city: str | None = None, currency: str = "USD", budget_max: float | None = None, retailers: list[str] | None = None) -> list[dict[str, Any]]` — raises `LlmError` on API failure. Task 4 calls this.

- [ ] **Step 1: Write the failing parser tests**

`backend/tests/test_grounded_search.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_grounded_search.py -v`
Expected: FAIL with `ImportError: cannot import name '_parse_grounded_products'`

- [ ] **Step 3: Extend `_gemini_generate` with the grounded flag**

In `backend/app/services/llm_service.py`, replace the current `_gemini_generate` (lines 33-56):

```python
async def _gemini_generate(
    parts: list[dict], *, json_mode: bool = True, grounded: bool = False
) -> str:
    if not _settings.gemini_api_key:
        raise LlmError("GEMINI_API_KEY is not configured")

    model = _settings.llm_model
    url = f"{_GEMINI_BASE}/models/{model}:generateContent"
    body: dict[str, Any] = {"contents": [{"parts": parts}]}
    if grounded:
        # google_search tool is incompatible with responseMimeType: application/json
        body["tools"] = [{"google_search": {}}]
    elif json_mode:
        body["generationConfig"] = {"responseMimeType": "application/json"}

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            url,
            params={"key": _settings.gemini_api_key},
            json=body,
        )
        if r.status_code >= 400:
            raise LlmError(f"Gemini error ({r.status_code}): {r.text[:300]}")
        data = r.json()

    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as e:
        raise LlmError(f"Unexpected Gemini response: {data}") from e
```

- [ ] **Step 4: Add the grounded shopping prompt, parser, and public function**

Append at the end of `backend/app/services/llm_service.py`:

```python
GROUNDED_SHOPPING_SYSTEM = """You are a shopping search agent. Use Google Search to find real clothing products currently sold online and available to shoppers in the given location.

Rules:
- Prefer local retailers and marketplaces that serve the location.
- Only include products you actually found via search, with their real listing URLs. Never invent products, stores, prices, or URLs.
- price is the listed price as a number in {currency}. If a listing uses another currency, convert approximately and still report currency as "{currency}".
- Respond ONLY with a JSON array, no prose:
[{"title": "<product name>", "price": <number>, "currency": "{currency}", "store": "<retailer name>", "product_url": "<https listing url>", "image_url": "<https image url or empty string>"}]
- Maximum 8 items. If you find nothing, respond with []."""


def _parse_grounded_products(raw: str) -> list[dict[str, Any]]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    if not text.startswith("["):
        # model may wrap the array in prose; grab the outermost JSON array
        m = re.search(r"\[.*\]", text, re.DOTALL)
        if not m:
            return []
        text = m.group(0)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    if isinstance(data, dict):
        data = data.get("products", [])
    if not isinstance(data, list):
        return []

    items: list[dict[str, Any]] = []
    for r in data:
        if not isinstance(r, dict):
            continue
        title = str(r.get("title") or "").strip()
        url = str(r.get("product_url") or "").strip()
        try:
            price = float(r.get("price"))
        except (TypeError, ValueError):
            continue
        if not title or price <= 0 or not url.startswith(("http://", "https://")):
            continue
        items.append(
            {
                "title": title,
                "price": price,
                "currency": str(r.get("currency") or "").strip() or "USD",
                "store": str(r.get("store") or "").strip() or "Online store",
                "product_url": url,
                "image_url": str(r.get("image_url") or "").strip(),
            }
        )
    return items[:8]


async def grounded_product_search(
    query: str,
    *,
    country: str | None = None,
    city: str | None = None,
    currency: str = "USD",
    budget_max: float | None = None,
    retailers: list[str] | None = None,
) -> list[dict[str, Any]]:
    location_parts = [p for p in (city, country.upper() if country else None) if p]
    location = ", ".join(location_parts) or "the user's area"

    prompt = GROUNDED_SHOPPING_SYSTEM.replace("{currency}", currency)
    if retailers:
        prompt += f"\nPrioritize these retailers when relevant: {', '.join(retailers)}."
    if budget_max:
        prompt += f"\nOnly include products priced at or below {budget_max:g} {currency}."
    prompt += f'\n\nSearch task: find "{query}" for sale online for a shopper in {location}.'

    raw = await _gemini_generate([{"text": prompt}], json_mode=False, grounded=True)
    return _parse_grounded_products(raw)
```

- [ ] **Step 5: Run tests to verify pass**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_grounded_search.py -v`
Expected: 6 PASSED.

- [ ] **Step 6: Run the full suite**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -v`
Expected: all PASSED.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/llm_service.py backend/tests/test_grounded_search.py
git commit -m "feat(shopping): Gemini google_search-grounded product search"
```

---

### Task 4: Tier-2 wiring in shopping_service + approx schema flag

When the Tier-1 product lane comes back empty (unsupported country, or supported but zero results) and a Gemini key exists, fill the product lane from grounded search. Grounded items carry `approx=True`.

**Files:**
- Modify: `backend/app/schemas/shopping.py` (add field to `ShoppingResultItem`, line 17-31)
- Modify: `backend/app/services/shopping_service.py` (`search_products` lines 111-119; new `_search_grounded` after `_search_serpapi`)
- Test: `backend/tests/test_shopping_service_tiers.py`

**Interfaces:**
- Consumes: `grounded_product_search` (Task 3 signature), `retailers_for` (Task 2), `currency_for` (existing).
- Produces:
  - `ShoppingResultItem.approx: bool = False` — serialized in every shopping response; frontend Task 5 reads it.
  - `async _search_grounded(query, budget_max, category, country, city) -> list[ShoppingResultItem]` (module-private).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_shopping_service_tiers.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_shopping_service_tiers.py -v`
Expected: FAIL — `test_unsupported_country_falls_back_to_grounded` fails with 0 products / `fake_grounded["count"] == 0`, and `approx` attribute errors.

- [ ] **Step 3: Add the `approx` field to the schema**

In `backend/app/schemas/shopping.py`, inside `ShoppingResultItem`, after `kind`:

```python
    kind: Literal["product", "store"] = "product"
    approx: bool = False  # True when price came from grounded LLM search, not a shopping feed
```

- [ ] **Step 4: Implement `_search_grounded` and wire the fallback**

In `backend/app/services/shopping_service.py`, replace lines 111-119 (the tail of `search_products`) with:

```python
    if isinstance(products, Exception):
        products = []
    if isinstance(stores, Exception):
        stores = []

    if not products and settings.gemini_api_key:
        products = await _search_grounded(query, budget_max, category, country, city)

    all_results = list(products) + list(stores)
    no_local = len(all_results) == 0

    return {"results": all_results, "currency": currency, "no_local": no_local}
```

Then add after `_search_serpapi` (i.e. before `_search_local_stores`):

```python
async def _search_grounded(
    query: str,
    budget_max: float | None,
    category: str | None,
    country: str | None,
    city: str | None,
) -> list[ShoppingResultItem]:
    import app.services.llm_service as llm
    from app.services.shopping_locale import currency_for, retailers_for

    currency = currency_for(country) if country else "USD"
    try:
        raw_items = await llm.grounded_product_search(
            query,
            country=country,
            city=city,
            currency=currency,
            budget_max=budget_max,
            retailers=retailers_for(country) if country else None,
        )
    except llm.LlmError:
        return []

    items: list[ShoppingResultItem] = []
    for r in raw_items:
        if budget_max and r["price"] > budget_max:
            continue
        items.append(
            ShoppingResultItem(
                title=r["title"],
                price=r["price"],
                currency=r["currency"] or currency,
                image_url=r["image_url"],
                product_url=r["product_url"],
                source=r["store"],
                category=category,
                kind="product",
                approx=True,
            )
        )
    return items
```

Note the module-object import (`import app.services.llm_service as llm`) — it keeps `monkeypatch.setattr(llm, "grounded_product_search", ...)` effective and matches how tests patch it.

- [ ] **Step 5: Run tests to verify pass**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests/test_shopping_service_tiers.py -v`
Expected: 4 PASSED.

- [ ] **Step 6: Run the full suite**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -v`
Expected: all PASSED.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/shopping.py backend/app/services/shopping_service.py backend/tests/test_shopping_service_tiers.py
git commit -m "feat(shopping): tier-2 grounded fallback when google_shopping has no coverage"
```

---

### Task 5: Frontend — approximate-price indicator

Grounded prices can be slightly stale, so render them with a `~` prefix. Backend already sends `approx`.

**Files:**
- Modify: `frontend/src/lib/api.ts` (the `ShoppingResultItem` type, add after `open_now` at line 102)
- Modify: `frontend/src/components/shop/ResultCard.tsx` (priceLabel at lines 30-34)

**Interfaces:**
- Consumes: `approx: bool` field from Task 4's API responses.
- Produces: no new exports; `ShoppingResultItem` type gains `approx?: boolean | null`.

- [ ] **Step 1: Add the field to the API type**

In `frontend/src/lib/api.ts`, in `ShoppingResultItem` after `open_now?: boolean | null;`:

```typescript
  open_now?: boolean | null;
  approx?: boolean | null;
```

- [ ] **Step 2: Prefix approximate prices in ResultCard**

In `frontend/src/components/shop/ResultCard.tsx`, replace lines 30-34:

```typescript
  const prefix = item.approx ? "~" : "";
  const priceLabel = converted != null
    ? `${prefix}${displayCurrency} ${converted.toFixed(2)}`
    : item.price != null
      ? `${prefix}${item.currency || "USD"} ${item.price.toFixed(2)}`
      : "Visit store";
```

- [ ] **Step 3: Typecheck and lint**

Run: `cd C:/Users/Envy/Desktop/VTO/frontend && npx tsc --noEmit && npm run lint`
Expected: no type errors; lint passes (warnings pre-existing in other files are acceptable).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts frontend/src/components/shop/ResultCard.tsx
git commit -m "feat(shop): tilde prefix for approximate grounded prices"
```

---

### Task 6: End-to-end verification against real APIs

Prove the tiers work with live keys. Requires `backend/.env` with real `GEMINI_API_KEY` (and optionally `SERPAPI_KEY`).

**Files:**
- No source changes. Verification only.

**Interfaces:**
- Consumes: everything above.
- Produces: evidence the feature works; any fixes discovered get their own commits.

- [ ] **Step 1: Run the full backend suite once more**

Run: `cd C:/Users/Envy/Desktop/VTO/backend && python -m pytest tests -v`
Expected: all PASSED.

- [ ] **Step 2: Live grounded search for an unsupported country**

Run from `backend/` (uses real Gemini key from `.env`):

```bash
cd C:/Users/Envy/Desktop/VTO/backend && python -c "
import asyncio
from app.services.shopping_service import search_products

r = asyncio.run(search_products('yellow summer dress', country='az', city='Baku'))
print('currency:', r['currency'], 'no_local:', r['no_local'])
for item in r['results']:
    print(item.kind, '| approx:', item.approx, '|', item.title, '|', item.price, item.currency, '|', item.source, '|', item.product_url)
"
```

Expected: `currency: AZN`, at least one `product | approx: True` row with a plausible price and a real local-retailer URL (birmarket.az / trendyol / similar). If SERPAPI_KEY is set, `store` rows from the google_local lane may appear too.

- [ ] **Step 3: Live search for a supported country (regression)**

```bash
cd C:/Users/Envy/Desktop/VTO/backend && python -c "
import asyncio
from app.services.shopping_service import search_products

r = asyncio.run(search_products('yellow summer dress', country='us', city='New York'))
print('currency:', r['currency'], 'results:', len(r['results']))
print('any approx:', any(i.approx for i in r['results']))
"
```

Expected (with SERPAPI_KEY set): `currency: USD`, results > 0, `any approx: False` — Tier 1 still owns supported countries. Without SERPAPI_KEY the mock path returns 8 items — also `approx: False`.

- [ ] **Step 4: UI spot-check**

Run: `cd C:/Users/Envy/Desktop/VTO/frontend && npm run dev`, open `http://localhost:3000/shop`, set location to Baku / AZ (or rely on geolocation), search "yellow summer dress".
Expected: product cards render with `~AZN <price>` on hover; store cards unchanged.

- [ ] **Step 5: Commit any fixes found during verification**

```bash
git add -A backend/app frontend/src
git commit -m "fix(shopping): grounded search follow-ups from live verification"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** priced products in unsupported countries (Tasks 3-4), local retailer preference (Task 2 + prompt injection in Task 3), price transparency (`approx` — Tasks 4-5), no regression for supported countries (Task 4 test 3 + Task 6 step 3), graceful degradation to the store lane (Task 4 test 4).
- **Known limitation (accepted):** grounded prices may lag listings; mitigated by the `~` indicator. Caching grounded results was considered and deferred — YAGNI until quota pressure appears (free tier: 1,500 grounded queries/day).
- **Type consistency check:** `grounded_product_search` kwargs match between Task 3 definition and Task 4 caller (`country, city, currency, budget_max, retailers`); parser dict keys (`title/price/currency/store/product_url/image_url`) match the `_search_grounded` mapper; `approx` spelled identically in schema, service, api.ts, ResultCard.
