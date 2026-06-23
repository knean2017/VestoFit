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


async def search_products(
    query: str,
    budget_max: float | None = None,
    category: str | None = None,
) -> list[ShoppingResultItem]:
    settings = get_settings()

    if settings.serpapi_key:
        return await _search_serpapi(query, budget_max, category, settings.serpapi_key)

    return _search_mock(query, budget_max, category)


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
) -> list[ShoppingResultItem]:
    import httpx

    params = {
        "engine": "google_shopping",
        "q": query,
        "api_key": api_key,
        "num": 20,
    }
    if budget_max:
        params["price_max"] = str(int(budget_max))

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get("https://serpapi.com/search", params=params)
        resp.raise_for_status()
        data = resp.json()

    items: list[ShoppingResultItem] = []
    for r in data.get("shopping_results", [])[:12]:
        price_str = r.get("extracted_price") or r.get("price", "0")
        try:
            price = float(str(price_str).replace("$", "").replace(",", ""))
        except ValueError:
            price = 0
        if budget_max and price > budget_max:
            continue
        items.append(
            ShoppingResultItem(
                title=r.get("title", ""),
                price=price,
                currency="USD",
                image_url=r.get("thumbnail", ""),
                product_url=r.get("link", ""),
                source=r.get("source", ""),
                category=category,
            )
        )
    return items
