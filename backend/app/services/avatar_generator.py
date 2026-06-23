"""Generate a canonical avatar by EDITING the user's best frontal photo.

We use FAL's **Flux Kontext** (instruction-based image editor). Unlike face-embedding
models such as PhotoMaker, Kontext does not synthesize a new person — it takes the
actual uploaded photo and surgically edits just what we ask:
  - clothing → plain white t-shirt + blue jeans
  - background → clean neutral white studio
  - everything else (face, hair, skin, body proportions, pose) is preserved.

This matches the requirement of "same face, same body proportions, straight pose."
"""

from __future__ import annotations

import asyncio
import os
import uuid

import httpx
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.avatar import Avatar
from app.services.storage import get_storage

_settings = get_settings()
_FAL_BASE = "https://queue.fal.run"
_POLL_INTERVAL_S = 2.0
_POLL_MAX_ATTEMPTS = 90


class GeneratorError(RuntimeError):
    pass


async def _fal_upload(data: bytes, content_type: str, filename: str) -> str:
    if not _settings.fal_key:
        raise GeneratorError("FAL_KEY is not configured")
    os.environ["FAL_KEY"] = _settings.fal_key

    import fal_client

    def _do() -> str:
        mod_upload = getattr(fal_client, "upload", None)
        if callable(mod_upload):
            return mod_upload(data, content_type, filename)
        return fal_client.SyncClient().upload(data, content_type, filename)

    return await asyncio.to_thread(_do)


def _select_best_frontal(avatar: Avatar) -> str:
    """The photo with the highest frontality score, falling back to the first."""
    scores = avatar.pose_scores or {}
    if scores:
        return max(avatar.photo_keys, key=lambda k: scores.get(k, 0.0))
    return avatar.photo_keys[0]


def _build_prompt() -> str:
    """Single-instruction Kontext prompt. Per Flux Kontext best practices,
    chained instructions cause drift, so we bundle the edit into one clear
    directive that lists everything to preserve."""
    return (
        "Edit this photograph: change the person's clothing to a plain solid "
        "white short-sleeve t-shirt and blue denim jeans. Replace the background "
        "with a clean neutral white studio backdrop. Use soft even studio lighting. "
        "Keep the person's face, hairstyle, skin tone, body proportions, body shape, "
        "height, weight, and pose exactly the same as in the original photo. "
        "Photorealistic, sharp focus, high quality, natural skin texture, no artifacts."
    )


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Key {_settings.fal_key}",
        "Content-Type": "application/json",
    }


def _model_endpoint() -> str:
    """Avatar editor model. Configurable so we can swap pro/max/dev."""
    return _settings.fal_avatar_model


async def _submit(model: str, payload: dict) -> dict:
    """Submit a queue request and return the raw response which includes
    `request_id`, `status_url`, and `response_url`. We poll those URLs
    directly because nested model IDs (e.g. fal-ai/flux-pro/kontext) use
    a shorter app namespace for status/result endpoints."""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{_FAL_BASE}/{model}", json=payload, headers=_headers())
        if r.status_code >= 400:
            raise GeneratorError(
                f"Kontext submit failed ({r.status_code}): {r.text[:300]}"
            )
        body = r.json()
        if "request_id" not in body:
            raise GeneratorError(f"Unexpected submit response: {body}")
        return body


async def _get(url: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            url, headers={"Authorization": f"Key {_settings.fal_key}"}
        )
        r.raise_for_status()
        return r.json()


def _extract_image_url(result: dict) -> str | None:
    if not isinstance(result, dict):
        return None
    images = result.get("images")
    if isinstance(images, list) and images:
        first = images[0]
        if isinstance(first, dict) and first.get("url"):
            return first["url"]
        if isinstance(first, str):
            return first
    img = result.get("image")
    if isinstance(img, dict) and img.get("url"):
        return img["url"]
    if isinstance(img, str):
        return img
    return None


async def generate_avatar(avatar_id: uuid.UUID, *, seed: int | None = None) -> None:
    """Background task. Builds the canonical avatar for the given avatar row."""
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Avatar).where(Avatar.id == avatar_id))
        avatar = res.scalar_one_or_none()
        if not avatar:
            return

        try:
            avatar.generation_status = "generating"
            avatar.generation_error = None
            await db.commit()

            storage = get_storage()
            source_key = _select_best_frontal(avatar)
            source_bytes = await storage.read_bytes(source_key)

            image_url = await _fal_upload(source_bytes, "image/jpeg", "source.jpg")

            model = _model_endpoint()
            payload: dict = {
                "prompt": _build_prompt(),
                "image_url": image_url,
                "aspect_ratio": "3:4",
                "num_images": 1,
                "safety_tolerance": "6",
                "output_format": "png",
            }
            if seed is not None:
                payload["seed"] = int(seed)

            submit_resp = await _submit(model, payload)
            status_url = submit_resp.get("status_url") or (
                f"{_FAL_BASE}/{model}/requests/{submit_resp['request_id']}/status"
            )
            response_url = submit_resp.get("response_url") or (
                f"{_FAL_BASE}/{model}/requests/{submit_resp['request_id']}"
            )

            for _ in range(_POLL_MAX_ATTEMPTS):
                st = await _get(status_url)
                s = (st.get("status") or "").upper()
                if s == "COMPLETED":
                    break
                if s in ("FAILED", "ERROR"):
                    raise GeneratorError(f"Kontext failed: {st}")
                await asyncio.sleep(_POLL_INTERVAL_S)
            else:
                raise GeneratorError("Avatar generation timed out")

            result = await _get(response_url)
            out_url = _extract_image_url(result)
            if not out_url:
                raise GeneratorError(f"No image in Kontext result: {result}")

            async with httpx.AsyncClient(timeout=60) as c:
                rr = await c.get(out_url)
                rr.raise_for_status()
                img_bytes = rr.content
                ct = rr.headers.get("content-type", "image/png")

            ext = ".png" if "png" in ct else ".jpg"
            new_key = f"avatars/{avatar.user_id}/canonical_{uuid.uuid4().hex}{ext}"
            await storage.save_bytes(new_key, img_bytes, ct)

            avatar.generated_photo_key = new_key
            avatar.base_photo_key = new_key
            avatar.generation_status = "completed"
            await db.commit()

        except Exception as e:  # noqa: BLE001
            avatar.generation_status = "failed"
            avatar.generation_error = str(e)[:500]
            await db.commit()
