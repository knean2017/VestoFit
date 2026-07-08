from pydantic import BaseModel, Field

from app.schemas.shopping import ShoppingResultItem


class StylistSuggestRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000)
    locked_item_ids: list[str] = Field(default_factory=list, max_length=2)


class StylistRerollRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000)
    locked_item_ids: list[str] = Field(default_factory=list, max_length=2)


class StylistSuggestResponse(BaseModel):
    outfit_id: str
    item_ids: list[str]
    reasoning: str
    decline: bool = False


class StylistMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    outfit_id: str | None = None
    created_at: str


class StyleProfileResponse(BaseModel):
    data: dict | None = None
    preferences: str | None = None
    updated_at: str | None = None


class StyleProfileUpdateRequest(BaseModel):
    preferences: str = Field(..., max_length=1000)


class StylistChatRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)


class StylistChatResponse(BaseModel):
    reply: str
    chips: list[str] | None = None
    outfit_id: str | None = None
    outfit_item_ids: list[str] | None = None
    results: list[ShoppingResultItem] | None = None
    search_query: str | None = None
    currency: str = "USD"
    no_local: bool = False
