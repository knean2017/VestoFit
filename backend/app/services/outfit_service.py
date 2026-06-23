"""Outfit validation, ordering, and CRUD helpers."""

from __future__ import annotations

import json
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.outfit import Outfit
from app.models.wardrobe_item import WardrobeItem


class OutfitValidationError(ValueError):
    pass


def compute_render_order(items: list[WardrobeItem]) -> list[WardrobeItem]:
    """Order garments for chained FASHN: base top → bottom → outer top."""
    dresses = [i for i in items if i.category == "dresses"]
    if dresses:
        if len(items) != 1:
            raise OutfitValidationError("A dress outfit must contain only one dress")
        return dresses

    tops = [i for i in items if i.category == "tops"]
    bottoms = [i for i in items if i.category == "bottoms"]
    if len(tops) < 1 or len(tops) > 2 or len(bottoms) != 1:
        raise OutfitValidationError(
            "Outfit must be one dress, or one top + one bottom, "
            "or two tops + one bottom"
        )
    if len(tops) == 1:
        return [tops[0], bottoms[0]]
    return [tops[0], bottoms[0], tops[1]]


def validate_combo(items: list[WardrobeItem]) -> None:
    compute_render_order(items)


async def fetch_owned_items(
    db: AsyncSession, user_id: uuid.UUID, item_ids: list[uuid.UUID]
) -> list[WardrobeItem]:
    if not item_ids:
        raise OutfitValidationError("No items selected")
    res = await db.execute(
        select(WardrobeItem).where(
            WardrobeItem.user_id == user_id,
            WardrobeItem.id.in_(item_ids),
        )
    )
    found = {i.id: i for i in res.scalars().all()}
    missing = [str(i) for i in item_ids if i not in found]
    if missing:
        raise OutfitValidationError(f"Unknown items: {', '.join(missing)}")
    return [found[i] for i in item_ids]


def wardrobe_catalog_json(items: list[WardrobeItem]) -> str:
    rows = []
    for i in items:
        rows.append(
            {
                "id": str(i.id),
                "name": i.name or i.category,
                "category": i.category,
                "color": i.color,
                "pattern": i.pattern,
                "formality": i.formality,
                "season": i.season,
                "warmth": i.warmth,
                "notes": i.user_notes,
                "conditions": i.conditions,
                "is_favorite": i.is_favorite,
            }
        )
    return json.dumps(rows, ensure_ascii=False)


async def create_outfit(
    db: AsyncSession,
    user_id: uuid.UUID,
    item_ids: list[uuid.UUID],
    *,
    source: str = "manual",
    prompt: str | None = None,
    reasoning: str | None = None,
) -> Outfit:
    items = await fetch_owned_items(db, user_id, item_ids)
    validate_combo(items)
    ordered = compute_render_order(items)
    outfit = Outfit(
        user_id=user_id,
        item_ids=[i.id for i in ordered],
        source=source,
        prompt=prompt,
        reasoning=reasoning,
        render_status="draft",
    )
    db.add(outfit)
    await db.commit()
    await db.refresh(outfit)
    return outfit


def http_validation_error(exc: OutfitValidationError) -> HTTPException:
    return HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
