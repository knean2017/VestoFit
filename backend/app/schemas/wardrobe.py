from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

WardrobeCategory = Literal["tops", "bottoms", "dresses"]
TaggingStatus = Literal["pending", "done", "failed"]


class WardrobeItemResponse(BaseModel):
    id: str
    category: WardrobeCategory
    image_url: str
    clean_image_url: str | None = None
    name: str | None = None
    color: str | None = None
    pattern: str | None = None
    formality: str | None = None
    season: str | None = None
    warmth: int | None = None
    user_notes: str | None = None
    conditions: str | None = None
    is_favorite: bool = False
    tagging_status: TaggingStatus = "pending"
    created_at: datetime


class WardrobeItemUpdate(BaseModel):
    category: WardrobeCategory | None = None
    name: str | None = Field(default=None, max_length=200)
    user_notes: str | None = Field(default=None, max_length=1000)
    conditions: str | None = Field(default=None, max_length=500)
    is_favorite: bool | None = None
