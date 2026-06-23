from pydantic import BaseModel, Field


class StylistSuggestRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000)
    locked_item_ids: list[str] = Field(default_factory=list, max_length=2)


class StylistRerollRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000)
    locked_item_ids: list[str] = Field(default_factory=list, max_length=2)


class StylistAskRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=2000)
    item_ids: list[str] = Field(default_factory=list, max_length=3)


class StylistSuggestResponse(BaseModel):
    outfit_id: str
    item_ids: list[str]
    reasoning: str
    decline: bool = False


class StylistAskResponse(BaseModel):
    reply: str


class StylistMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    outfit_id: str | None = None
    created_at: str
