"""Shared FAL try-on render — single garment on a person image."""

from __future__ import annotations

import asyncio
import os

import httpx

from app.config import get_settings
from app.services.tryon_service import (
    FalError,
    _extract_image_url,
    _fal_get,
    _fal_submit,
    _fal_upload,
    _payload_for_model,
)

_settings = get_settings()
_FAL_BASE = "https://queue.fal.run"
_POLL_INTERVAL_S = 2.0
_POLL_MAX_ATTEMPTS = 90


async def render_garment_on_person(
    person_bytes: bytes,
    garment_bytes: bytes,
    category: str,
    *,
    person_mime: str = "image/jpeg",
    garment_mime: str = "image/png",
    description: str | None = None,
) -> bytes:
    """Run one FASHN/Kling try-on pass. Returns result image bytes."""
    if not _settings.fal_key:
        raise FalError("FAL_KEY is not configured")
    os.environ["FAL_KEY"] = _settings.fal_key

    person_url = await _fal_upload(person_bytes, person_mime, "person.jpg")
    garment_url = await _fal_upload(garment_bytes, garment_mime, "garment.png")

    model = _settings.fal_tryon_model
    payload = _payload_for_model(
        model, person_url, garment_url, category, description
    )
    submit_resp = await _fal_submit(model, payload)
    request_id = submit_resp["request_id"]
    status_url = submit_resp.get("status_url") or (
        f"{_FAL_BASE}/{model}/requests/{request_id}/status"
    )
    response_url = submit_resp.get("response_url") or (
        f"{_FAL_BASE}/{model}/requests/{request_id}"
    )

    for _ in range(_POLL_MAX_ATTEMPTS):
        status = await _fal_get(status_url)
        s = (status.get("status") or "").upper()
        if s == "COMPLETED":
            break
        if s in ("FAILED", "ERROR"):
            raise FalError(f"FAL job failed: {status}")
        await asyncio.sleep(_POLL_INTERVAL_S)
    else:
        raise FalError("FAL job timed out")

    result = await _fal_get(response_url)
    image_url = _extract_image_url(result)
    if not image_url:
        raise FalError(f"FAL returned no image URL. Raw: {result}")

    async with httpx.AsyncClient(timeout=60) as c:
        rr = await c.get(image_url)
        rr.raise_for_status()
        return rr.content
