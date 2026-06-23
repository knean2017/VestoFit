"""Chained FASHN render for a saved outfit."""

from __future__ import annotations

import uuid

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.avatar import Avatar
from app.models.outfit import Outfit
from app.models.wardrobe_item import WardrobeItem
from app.services.fal_render_service import render_garment_on_person
from app.services.outfit_service import compute_render_order
from app.services.storage import get_storage
from app.services.tryon_service import FalError


async def run_outfit_render(outfit_id: uuid.UUID) -> None:
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Outfit).where(Outfit.id == outfit_id))
        outfit = res.scalar_one_or_none()
        if not outfit:
            return

        try:
            outfit.render_status = "rendering"
            outfit.error_message = None
            await db.commit()

            avatar_res = await db.execute(
                select(Avatar).where(Avatar.user_id == outfit.user_id)
            )
            avatar = avatar_res.scalar_one_or_none()
            if not avatar:
                raise FalError("Upload an avatar photo first")

            items_res = await db.execute(
                select(WardrobeItem).where(
                    WardrobeItem.id.in_(outfit.item_ids),
                    WardrobeItem.user_id == outfit.user_id,
                )
            )
            by_id = {i.id: i for i in items_res.scalars().all()}
            items = [by_id[i] for i in outfit.item_ids if i in by_id]
            ordered = compute_render_order(items)

            storage = get_storage()
            person_bytes = await storage.read_bytes(avatar.photo_key)

            for item in ordered:
                gkey = item.clean_image_key or item.image_key
                garment_bytes = await storage.read_bytes(gkey)
                person_bytes = await render_garment_on_person(
                    person_bytes,
                    garment_bytes,
                    item.category,
                    garment_mime="image/png" if gkey.endswith(".png") else "image/jpeg",
                )

            result_key = f"outfits/{outfit.user_id}/{uuid.uuid4().hex}.png"
            await storage.save_bytes(result_key, person_bytes, "image/png")
            outfit.result_key = result_key
            outfit.render_status = "completed"
        except Exception as e:  # noqa: BLE001
            outfit.render_status = "failed"
            outfit.error_message = str(e)[:1000]
        finally:
            await db.commit()
