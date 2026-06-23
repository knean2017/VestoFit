"""Try-on orchestration: FAL.ai integration + background job runner.

Pipeline executed in a background task:
  1. (URL job only) scrape garment image from retail page, remove background
  2. Upload person + garment image bytes to FAL's CDN (so FAL workers can fetch)
  3. Submit a request to FAL's queue API
  4. Poll for completion (~10-30s typical)
  5. Download the resulting image, persist it to our storage
  6. Update the job row to status='completed'

If anything fails the job is marked 'failed' with the error message.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

import httpx
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.avatar import Avatar
from app.models.job import TryOnJob
from app.services.garment_service import clean_garment, infer_category
from app.services.scraper_service import fetch_garment_image
from app.services.storage import get_storage

_settings = get_settings()
_FAL_BASE = "https://queue.fal.run"
_POLL_INTERVAL_S = 2.0
_POLL_MAX_ATTEMPTS = 90  # ~3 minutes


class FalError(RuntimeError):
    pass


async def _fal_upload(data: bytes, content_type: str, filename: str) -> str:
    """Upload bytes to FAL's CDN; returns a public URL FAL workers can fetch.

    Works with both fal-client 0.5.x (module-level upload) and 1.0+
    (SyncClient.upload). Keeps the call sync-friendly via to_thread.
    """
    if not _settings.fal_key:
        raise FalError("FAL_KEY is not configured")
    os.environ["FAL_KEY"] = _settings.fal_key

    import fal_client

    def _do() -> str:
        mod_upload = getattr(fal_client, "upload", None)
        if callable(mod_upload):
            return mod_upload(data, content_type, filename)
        return fal_client.SyncClient().upload(data, content_type, filename)

    return await asyncio.to_thread(_do)


async def _fal_submit(model: str, payload: dict) -> dict:
    """Submit and return the full response dict (includes status_url and
    response_url). Polling those URLs directly avoids issues with
    slash-nested model IDs like fal-ai/kling/v1-5/kolors-virtual-try-on."""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(
            f"{_FAL_BASE}/{model}",
            json=payload,
            headers={
                "Authorization": f"Key {_settings.fal_key}",
                "Content-Type": "application/json",
            },
        )
        if r.status_code >= 400:
            raise FalError(f"FAL submit failed ({r.status_code}): {r.text}")
        body = r.json()
        if "request_id" not in body:
            raise FalError(f"Unexpected submit response: {body}")
        return body


async def _fal_get(url: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(
            url, headers={"Authorization": f"Key {_settings.fal_key}"}
        )
        r.raise_for_status()
        return r.json()


def _payload_for_model(
    model: str,
    person_url: str,
    garment_url: str,
    category: str,
    description: str | None,
) -> dict:
    """Map our generic params to the model-specific FAL payload schema.
    Centralized so we can swap models without touching the rest of the pipeline.
    """
    # Kling Kolors v1.5 — best identity preservation per 2026 benchmarks.
    if "kolors-virtual-try-on" in model or "kling" in model:
        return {
            "human_image_url": person_url,
            "garment_image_url": garment_url,
        }

    # CatVTON — high quality settings. num_inference_steps capped at 50 by the API.
    if "cat-vton" in model or "catvton" in model:
        cloth_type = (
            "upper"
            if category == "tops"
            else ("lower" if category == "bottoms" else "overall")
        )
        return {
            "human_image_url": person_url,
            "garment_image_url": garment_url,
            "cloth_type": cloth_type,
            "num_inference_steps": 50,
            "guidance_scale": 2.5,
            "image_size": "portrait_4_3",
        }

    # FASHN v1.6 — best for complex fabrics. Auto photo-type handles model,
    # flat-lay, and ghost-mannequin images equally.
    if "fashn" in model:
        return {
            "model_image": person_url,
            "garment_image": garment_url,
            "category": category,
            "mode": "quality",
            "output_format": "png",
            "garment_photo_type": "auto",
        }

    # Image-apps v2 virtual try-on — simple, 4K, pose-preserving.
    if "image-apps-v2/virtual-try-on" in model:
        return {
            "person_image_url": person_url,
            "clothing_image_url": garment_url,
            "preserve_pose": True,
            "aspect_ratio": "3:4",
        }

    if "leffa" in model:
        return {
            "src_image_url": person_url,
            "ref_image_url": garment_url,
            "ref_acceleration": True,
        }

    if "idm-vton" in model:
        return {
            "human_image_url": person_url,
            "garment_image_url": garment_url,
            "description": description or _default_description(category),
            "category": category,
        }

    # Fallback: Kling-style schema (most common modern shape).
    return {
        "human_image_url": person_url,
        "garment_image_url": garment_url,
    }


def _default_description(category: str) -> str:
    return {
        "tops": "a top garment",
        "bottoms": "a bottom garment",
        "dresses": "a dress",
    }.get(category, "a garment")


def _extract_image_url(result: dict) -> str | None:
    """FAL responses vary across models — try the common shapes."""
    if not isinstance(result, dict):
        return None
    candidates: list = []
    for key in ("image", "output", "result"):
        v = result.get(key)
        if isinstance(v, dict):
            candidates.append(v)
    candidates.append(result)

    for c in candidates:
        if not isinstance(c, dict):
            continue
        for key in ("image", "result_image", "tryon_image"):
            v = c.get(key)
            if isinstance(v, dict) and v.get("url"):
                return v["url"]
            if isinstance(v, str) and v.startswith("http"):
                return v
        imgs = c.get("images")
        if isinstance(imgs, list) and imgs:
            first = imgs[0]
            if isinstance(first, dict) and first.get("url"):
                return first["url"]
            if isinstance(first, str) and first.startswith("http"):
                return first
        if isinstance(c.get("url"), str):
            return c["url"]
    return None


async def run_tryon_job(job_id: uuid.UUID) -> None:
    """Background task entrypoint. Creates its own DB session and runs the pipeline."""
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(TryOnJob).where(TryOnJob.id == job_id))
        job = res.scalar_one_or_none()
        if not job:
            return

        try:
            await _execute(db, job)
        except Exception as e:  # noqa: BLE001 — we want to swallow & record everything
            job.status = "failed"
            job.error_message = str(e)[:1000]
            job.completed_at = datetime.now(timezone.utc)
            await db.commit()


async def _execute(db, job: TryOnJob) -> None:
    storage = get_storage()

    avatar_res = await db.execute(select(Avatar).where(Avatar.id == job.avatar_id))
    avatar = avatar_res.scalar_one()

    if job.source_url and not job.garment_key:
        garment_bytes, _ct = await fetch_garment_image(job.source_url)
        cleaned = await clean_garment(garment_bytes)
        gkey = f"garments/{job.user_id}/{uuid.uuid4().hex}.png"
        await storage.save_bytes(gkey, cleaned, "image/png")
        job.garment_key = gkey
        await db.commit()

    if not job.garment_key:
        raise FalError("Job has no garment image")

    job.status = "processing"
    await db.commit()

    person_bytes = await storage.read_bytes(avatar.photo_key)
    garment_bytes = await storage.read_bytes(job.garment_key)

    person_url = await _fal_upload(person_bytes, "image/jpeg", "person.jpg")
    garment_url = await _fal_upload(garment_bytes, "image/png", "garment.png")

    model = _settings.fal_tryon_model
    category = infer_category(job.source_url, job.description)
    if job.category and job.category != "tops":
        # honour an explicitly set non-default category
        category = job.category
    payload = _payload_for_model(
        model, person_url, garment_url, category, job.description
    )
    submit_resp = await _fal_submit(model, payload)
    request_id = submit_resp["request_id"]
    status_url = submit_resp.get("status_url") or (
        f"{_FAL_BASE}/{model}/requests/{request_id}/status"
    )
    response_url = submit_resp.get("response_url") or (
        f"{_FAL_BASE}/{model}/requests/{request_id}"
    )
    job.fal_request_id = request_id
    await db.commit()

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
        result_bytes = rr.content
        result_ct = rr.headers.get("content-type", "image/png")

    ext = ".png" if "png" in result_ct else ".jpg"
    result_key = f"results/{job.user_id}/{uuid.uuid4().hex}{ext}"
    await storage.save_bytes(result_key, result_bytes, result_ct)

    job.result_key = result_key
    job.status = "completed"
    job.completed_at = datetime.now(timezone.utc)
    await db.commit()
