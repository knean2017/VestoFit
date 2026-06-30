from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ShoppingSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=500)
    budget_max: float | None = Field(default=None, gt=0)
    category: str | None = None
    country: str | None = None
    city: str | None = None
    lat: float | None = None
    lng: float | None = None


class ShoppingResultItem(BaseModel):
    title: str
    price: float | None = None
    currency: str = "USD"
    image_url: str
    product_url: str
    source: str
    category: str | None = None
    kind: Literal["product", "store"] = "product"
    # store-only fields
    address: str | None = None
    phone: str | None = None
    rating: float | None = None
    rating_count: int | None = None
    open_now: bool | None = None


class ShoppingSearchResponse(BaseModel):
    query: str
    results: list[ShoppingResultItem]
    total: int
    city: str | None = None
    currency: str = "USD"
    no_local: bool = False


class ShoppingHistoryItem(BaseModel):
    id: str
    query: str
    budget_max: float | None
    category: str | None
    result_count: int
    created_at: datetime


class ShoppingMessageItem(BaseModel):
    role: str
    content: str


class ShoppingAskRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    history: list[ShoppingMessageItem] | None = None
    country: str | None = None
    city: str | None = None
    lat: float | None = None
    lng: float | None = None


class ShoppingAskResponse(BaseModel):
    reply: str
    results: list[ShoppingResultItem] | None = None
    search_query: str | None = None
    chips: list[str] | None = None
    city: str | None = None
    currency: str = "USD"
    no_local: bool = False
