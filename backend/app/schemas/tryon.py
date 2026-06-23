from datetime import datetime
from typing import Literal

from pydantic import BaseModel, HttpUrl

Category = Literal["tops", "bottoms", "dresses"]
JobStatus = Literal["queued", "processing", "completed", "failed"]


class TryOnUrlRequest(BaseModel):
    garment_url: HttpUrl
    category: Category | None = None   # auto-detected if omitted
    description: str | None = None


class TryOnJobResponse(BaseModel):
    job_id: str
    status: JobStatus


class TryOnStatus(BaseModel):
    job_id: str
    status: JobStatus
    result_url: str | None = None
    garment_url: str | None = None
    source_url: str | None = None
    category: Category | None = None
    error: str | None = None
    created_at: datetime
