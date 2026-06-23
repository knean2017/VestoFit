"""Stylist LLM orchestration — suggest, reroll, ask."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stylist_message import StylistMessage
from app.models.wardrobe_item import WardrobeItem
from app.services.llm_service import LlmError, stylist_ask, stylist_suggest
from app.services.outfit_service import (
    OutfitValidationError,
    create_outfit,
    fetch_owned_items,
    validate_combo,
    wardrobe_catalog_json,
)


async def _load_wardrobe(db: AsyncSession, user_id: uuid.UUID) -> list[WardrobeItem]:
    res = await db.execute(
        select(WardrobeItem)
        .where(WardrobeItem.user_id == user_id)
        .order_by(WardrobeItem.created_at.desc())
    )
    return list(res.scalars().all())


def _parse_item_ids(raw: list) -> list[uuid.UUID]:
    out: list[uuid.UUID] = []
    for x in raw:
        try:
            out.append(uuid.UUID(str(x)))
        except ValueError:
            continue
    return out


def _deterministic_pick(
    items: list[WardrobeItem], locked: list[WardrobeItem]
) -> list[WardrobeItem]:
    locked_ids = {i.id for i in locked}
    dresses = [i for i in items if i.category == "dresses" and i.id not in locked_ids]
    tops = [i for i in items if i.category == "tops" and i.id not in locked_ids]
    bottoms = [
        i for i in items if i.category == "bottoms" and i.id not in locked_ids
    ]

    if locked:
        combo = list(locked)
        cats = {i.category for i in locked}
        if "dresses" in cats:
            return locked[:1]
        if "bottoms" not in cats and bottoms:
            combo.append(bottoms[0])
        elif "tops" not in cats and tops:
            combo.append(tops[0])
        validate_combo(combo)
        return combo

    if dresses:
        return [dresses[0]]
    if tops and bottoms:
        return [tops[0], bottoms[0]]
    raise OutfitValidationError("Not enough items in wardrobe for an outfit")


async def _llm_pick(
    db: AsyncSession,
    user_id: uuid.UUID,
    prompt: str,
    locked_item_ids: list[uuid.UUID],
) -> tuple[list[uuid.UUID], str, bool]:
    wardrobe = await _load_wardrobe(db, user_id)
    if not wardrobe:
        raise OutfitValidationError("Your wardrobe is empty")

    locked: list[WardrobeItem] = []
    if locked_item_ids:
        locked = await fetch_owned_items(db, user_id, locked_item_ids)

    catalog = wardrobe_catalog_json(wardrobe)
    full_prompt = prompt
    if locked:
        locked_desc = ", ".join(
            f"{i.name or i.category} ({i.id})" for i in locked
        )
        full_prompt = (
            f"{prompt}\n\nMust include these locked items: {locked_desc}"
        )

    try:
        result = await stylist_suggest(catalog, full_prompt)
    except LlmError:
        picked = _deterministic_pick(wardrobe, locked)
        return [i.id for i in picked], "Picked a combo from your wardrobe.", False

    if result.get("decline"):
        return [], result.get("reasoning") or "I can only help with outfits.", True

    ids = _parse_item_ids(result.get("items") or [])
    if locked:
        for lid in locked_item_ids:
            if lid not in ids:
                ids.insert(0, lid)
    ids = list(dict.fromkeys(ids))

    try:
        items = await fetch_owned_items(db, user_id, ids)
        validate_combo(items)
        reasoning = str(result.get("reasoning") or "Here's a look from your closet.")
        return [i.id for i in items], reasoning, False
    except OutfitValidationError:
        try:
            retry = await stylist_suggest(
                catalog,
                full_prompt + "\n\nPrevious combo was invalid. Return a valid combo.",
            )
            if retry.get("decline"):
                return [], retry.get("reasoning") or "", True
            ids = _parse_item_ids(retry.get("items") or [])
            items = await fetch_owned_items(db, user_id, ids)
            validate_combo(items)
            return (
                [i.id for i in items],
                str(retry.get("reasoning") or ""),
                False,
            )
        except (LlmError, OutfitValidationError):
            picked = _deterministic_pick(wardrobe, locked)
            return [i.id for i in picked], "Picked a combo from your wardrobe.", False


async def suggest_outfit(
    db: AsyncSession,
    user_id: uuid.UUID,
    prompt: str,
    locked_item_ids: list[uuid.UUID] | None = None,
):
    locked_item_ids = locked_item_ids or []
    ids, reasoning, decline = await _llm_pick(db, user_id, prompt, locked_item_ids)
    if decline:
        return None, ids, reasoning, True

    outfit = await create_outfit(
        db,
        user_id,
        ids,
        source="llm",
        prompt=prompt,
        reasoning=reasoning,
    )
    return outfit, ids, reasoning, False


async def ask_stylist(
    db: AsyncSession,
    user_id: uuid.UUID,
    prompt: str,
    item_ids: list[uuid.UUID] | None = None,
) -> str:
    wardrobe = await _load_wardrobe(db, user_id)
    catalog = wardrobe_catalog_json(wardrobe)
    id_strs = [str(i) for i in item_ids] if item_ids else None

    try:
        reply = await stylist_ask(catalog, prompt, item_ids=id_strs)
    except LlmError as e:
        reply = str(e)

    db.add(
        StylistMessage(user_id=user_id, role="user", content=prompt)
    )
    db.add(
        StylistMessage(user_id=user_id, role="assistant", content=reply)
    )
    await db.commit()
    return reply
