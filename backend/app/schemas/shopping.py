from datetime import datetime

from pydantic import BaseModel, Field


class ShoppingSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    budget_max: float | None = Field(default=None, gt=0)
    category: str | None = None


class ShoppingResultItem(BaseModel):
    title: str
    price: float
    currency: str = "USD"
    image_url: str
    product_url: str
    source: str
    category: str | None = None


class ShoppingSearchResponse(BaseModel):
    query: str
    results: list[ShoppingResultItem]
    total: int


class ShoppingHistoryItem(BaseModel):
    id: str
    query: str
    budget_max: float | None
    category: str | None
    result_count: int
    created_at: datetime
