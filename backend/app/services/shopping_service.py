import asyncio

from app.config import get_settings
from app.schemas.shopping import ShoppingResultItem

MOCK_RESULTS: list[dict] = [
    {
        "title": "Relaxed Fit Oxford Shirt",
        "price": 39.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/FF6B5E/white?text=Shirt",
        "product_url": "https://example.com/oxford-shirt",
        "source": "H&M",
        "category": "tops",
    },
    {
        "title": "Slim Tapered Chinos",
        "price": 49.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/3DB6A8/white?text=Chinos",
        "product_url": "https://example.com/chinos",
        "source": "Zara",
        "category": "bottoms",
    },
    {
        "title": "Oversized Linen Blazer",
        "price": 89.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/2A2522/white?text=Blazer",
        "product_url": "https://example.com/blazer",
        "source": "Uniqlo",
        "category": "tops",
    },
    {
        "title": "High-Waist Wide Leg Pants",
        "price": 59.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/8C8279/white?text=Pants",
        "product_url": "https://example.com/wide-pants",
        "source": "ASOS",
        "category": "bottoms",
    },
    {
        "title": "Midi Wrap Dress",
        "price": 69.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/FF6B5E/white?text=Dress",
        "product_url": "https://example.com/wrap-dress",
        "source": "Mango",
        "category": "dresses",
    },
    {
        "title": "Cotton Crew Neck Tee",
        "price": 19.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/3DB6A8/white?text=Tee",
        "product_url": "https://example.com/crew-tee",
        "source": "H&M",
        "category": "tops",
    },
    {
        "title": "Straight Leg Jeans",
        "price": 45.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/2A2522/white?text=Jeans",
        "product_url": "https://example.com/jeans",
        "source": "Levi's",
        "category": "bottoms",
    },
    {
        "title": "Satin Slip Dress",
        "price": 54.99,
        "currency": "USD",
        "image_url": "https://placehold.co/400x600/E8DFF5/333?text=Slip+Dress",
        "product_url": "https://example.com/slip-dress",
        "source": "Zara",
        "category": "dresses",
    },
]


async def _empty_list() -> list:
    return []


async def search_products(
    query: str,
    budget_max: float | None = None,
    category: str | None = None,
    country: str | None = None,
    city: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
) -> dict:
    from app.services.shopping_locale import currency_for

    settings = get_settings()
    currency = currency_for(country) if country else "USD"

    if not settings.serpapi_key:
        results = _search_mock(query, budget_max, category)
        return {"results": results, "currency": currency, "no_local": False}

    products, stores = await asyncio.gather(
        _search_serpapi(query, budget_max, category, settings.serpapi_key, country, city),
        _search_local_stores(query, city, settings.serpapi_key, country, lat, lng) if city
        else _empty_list(),
        return_exceptions=True,
    )

    if isinstance(products, Exception):
        products = []
    if isinstance(stores, Exception):
        stores = []

    if not products and settings.gemini_api_key:
        products = await _search_grounded(query, budget_max, category, country, city)

    all_results = list(products) + list(stores)
    no_local = len(all_results) == 0

    return {"results": all_results, "currency": currency, "no_local": no_local}


def _search_mock(
    query: str,
    budget_max: float | None,
    category: str | None,
) -> list[ShoppingResultItem]:
    results = MOCK_RESULTS
    if category:
        results = [r for r in results if r["category"] == category]
    if budget_max:
        results = [r for r in results if r["price"] <= budget_max]
    return [ShoppingResultItem(**r) for r in results]


async def _search_serpapi(
    query: str,
    budget_max: float | None,
    category: str | None,
    api_key: str,
    country: str | None = None,
    city: str | None = None,
) -> list[ShoppingResultItem]:
    import httpx

    from app.services.shopping_locale import currency_for, locale_for

    locale = locale_for(country) if country else None
    if locale is None and country:
        return []  # unsupported for google_shopping

    params = {
        "engine": "google_shopping",
        "q": query,
        "api_key": api_key,
        "num": 20,
    }
    if locale:
        params["gl"] = locale["gl"]
        params["hl"] = locale["hl"]
        params["google_domain"] = locale["google_domain"]
        if city:
            params["location"] = city
        else:
            params["location"] = locale["location"]
    if budget_max:
        params["price_max"] = str(int(budget_max))

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get("https://serpapi.com/search", params=params)
        resp.raise_for_status()
        data = resp.json()

    item_currency = currency_for(country) if country else "USD"
    items: list[ShoppingResultItem] = []
    for r in data.get("shopping_results", [])[:12]:
        price_str = r.get("extracted_price") or r.get("price", "0")
        try:
            price = float(str(price_str).replace("$", "").replace(",", ""))
        except ValueError:
            price = 0
        if budget_max and price > budget_max:
            continue
        product_url = r.get("product_link") or r.get("link", "")
        items.append(
            ShoppingResultItem(
                title=r.get("title", ""),
                price=price,
                currency=item_currency,
                image_url=r.get("thumbnail", ""),
                product_url=product_url,
                source=r.get("source", ""),
                category=category,
                kind="product",
            )
        )
    return items


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


async def _search_local_stores(
    query: str,
    city: str,
    api_key: str,
    country: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
) -> list[ShoppingResultItem]:
    import httpx

    from app.services.shopping_locale import currency_for, locale_for

    params = {
        "engine": "google_local",
        "q": f"{query} clothing store",
        "api_key": api_key,
        "location": city,
        "num": 10,
    }
    if lat is not None and lng is not None:
        params["ll"] = f"@{lat},{lng},14z"
    locale = locale_for(country) if country else None
    if locale:
        params["gl"] = locale["gl"]
        params["hl"] = locale["hl"]

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get("https://serpapi.com/search", params=params)
        resp.raise_for_status()
        data = resp.json()

    item_currency = currency_for(country) if country else "USD"
    items: list[ShoppingResultItem] = []
    for r in data.get("local_results", [])[:8]:
        thumbnail = r.get("thumbnail") or ""
        website = (r.get("links") or {}).get("website") or r.get("website") or ""
        if not website:
            continue  # skip stores with no website
        open_state = r.get("open_state") or ""
        open_now: bool | None = None
        if open_state:
            open_now = "open" in open_state.lower()
        items.append(ShoppingResultItem(
            title=r.get("title", ""),
            price=None,
            currency=item_currency,
            image_url=thumbnail,
            product_url=website,
            source=r.get("title", ""),
            category=None,
            kind="store",
            address=r.get("address") or None,
            phone=r.get("phone") or None,
            rating=r.get("rating") or None,
            rating_count=r.get("reviews") or None,
            open_now=open_now,
        ))
    return items


from app.services.llm_service import LlmError, shopping_ask


async def ask_shopping_assistant(
    prompt: str,
    history: list[dict[str, str]] | None = None,
    country: str | None = None,
    city: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
) -> dict:
    from app.services.shopping_locale import currency_for
    currency = currency_for(country) if country else "USD"

    try:
        result = shopping_ask(prompt, history)
        llm_result = await result
    except LlmError:
        return {
            "reply": "I'm having trouble thinking right now. Try again in a moment.",
            "results": None,
            "search_query": None,
            "chips": None,
            "currency": currency,
            "no_local": False,
        }

    search_params = llm_result.get("search")
    results = None
    search_query = None
    no_local = False

    if search_params and isinstance(search_params, dict):
        query = search_params.get("query", "").strip()
        if query:
            search_query = query
            budget_max = search_params.get("budget_max")
            category = search_params.get("category")
            if isinstance(budget_max, (int, float)) and budget_max > 0:
                budget_max = float(budget_max)
            else:
                budget_max = None
            if category not in ("tops", "bottoms", "dresses"):
                category = None
            product_result = await search_products(
                query=query,
                budget_max=budget_max,
                category=category,
                country=country,
                city=city,
                lat=lat,
                lng=lng,
            )
            results = product_result["results"]
            currency = product_result["currency"]
            no_local = product_result["no_local"]

    reply = llm_result.get("reply", "")
    if no_local and city:
        reply += f" I couldn't find any clothing results in {city} right now."

    return {
        "reply": reply,
        "results": results,
        "search_query": search_query,
        "chips": llm_result.get("chips"),
        "currency": currency,
        "no_local": no_local,
    }
