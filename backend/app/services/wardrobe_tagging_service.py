"""Background vision tagging for wardrobe items."""

from __future__ import annotations

import uuid as _uuid

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.wardrobe_item import WardrobeItem
from app.services.garment_service import clean_garment
from app.services.llm_service import LlmError, tag_garment_image
from app.services.storage import get_storage


async def tag_wardrobe_item(item_id: _uuid.UUID) -> None:
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(WardrobeItem).where(WardrobeItem.id == item_id)
        )
        item = res.scalar_one_or_none()
        if not item:
            return

        try:
            storage = get_storage()
            data = await storage.read_bytes(item.image_key)
            ext = item.image_key.rsplit(".", 1)[-1].lower()
            mime = {
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "png": "image/png",
                "webp": "image/webp",
            }.get(ext, "image/jpeg")

            result = await tag_garment_image(data, mime)
            if result.get("category") is None:
                item.tagging_status = "failed"
                item.attributes = result
            else:
                cat = result.get("category")
                if cat in ("tops", "bottoms", "dresses"):
                    item.category = cat
                item.name = result.get("name") or item.name
                item.color = result.get("color")
                item.pattern = result.get("pattern")
                item.formality = result.get("formality")
                item.season = result.get("season")
                warmth = result.get("warmth")
                item.warmth = int(warmth) if warmth is not None else None
                item.attributes = result
                item.tagging_status = "done"

                # Re-run background removal and update clean image
                cleaned = await clean_garment(data)
                clean_key = f"wardrobe/{item.user_id}/{_uuid.uuid4().hex}.png"
                await storage.save_bytes(clean_key, cleaned, "image/png")
                item.clean_image_key = clean_key

        except (LlmError, ValueError, TypeError) as e:
            item.tagging_status = "failed"
            item.attributes = {"error": str(e)[:500]}
        except Exception as e:  # noqa: BLE001
            item.tagging_status = "failed"
            item.attributes = {"error": str(e)[:500]}

        await db.commit()
