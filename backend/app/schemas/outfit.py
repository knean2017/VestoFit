from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.wardrobe import WardrobeItemResponse

OutfitSource = Literal["llm", "manual"]
RenderStatus = Literal["draft", "rendering", "completed", "failed"]


class OutfitCreate(BaseModel):
    item_ids: list[str] = Field(..., min_length=1, max_length=3)


class OutfitResponse(BaseModel):
    id: str
    prompt: str | None = None
    reasoning: str | None = None
    item_ids: list[str]
    source: OutfitSource
    items: list[WardrobeItemResponse] = []
    result_url: str | None = None
    render_status: RenderStatus
    error_message: str | None = None
    created_at: datetime


class OutfitRenderResponse(BaseModel):
    outfit_id: str
    render_status: RenderStatus
