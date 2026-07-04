"""Stylist LLM orchestration — suggest, reroll, ask."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stylist_message import StylistMessage
from app.models.wardrobe_item import WardrobeItem
from app.services.llm_service import LlmError, stylist_ask_structured, stylist_suggest
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
) -> dict:
    wardrobe = await _load_wardrobe(db, user_id)
    catalog = wardrobe_catalog_json(wardrobe)
    id_strs = [str(i) for i in item_ids] if item_ids else None

    try:
        result = await stylist_ask_structured(catalog, prompt, item_ids=id_strs)
    except LlmError as e:
        result = {"reply": str(e), "chips": None}

    db.add(
        StylistMessage(user_id=user_id, role="user", content=prompt)
    )
    db.add(
        StylistMessage(user_id=user_id, role="assistant", content=result["reply"])
    )
    await db.commit()
    return result


async def _recent_history(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 12
) -> list[dict[str, str]]:
    res = await db.execute(
        select(StylistMessage)
        .where(StylistMessage.user_id == user_id)
        .order_by(StylistMessage.created_at.desc())
        .limit(limit)
    )
    rows = list(res.scalars().all())
    return [{"role": m.role, "content": m.content} for m in reversed(rows)]


async def _load_profile_data(db: AsyncSession, user_id: uuid.UUID) -> dict | None:
    from app.services.style_profile_service import get_profile_data

    return await get_profile_data(db, user_id)


async def chat_with_stylist(db: AsyncSession, user, prompt: str) -> dict:
    import app.services.llm_service as llm
    import app.services.shopping_service as shopping

    wardrobe = await _load_wardrobe(db, user.id)
    catalog = wardrobe_catalog_json(wardrobe)
    profile = await _load_profile_data(db, user.id)
    history = await _recent_history(db, user.id)

    try:
        parsed = await llm.stylist_chat(
            catalog,
            prompt,
            history=history,
            profile=profile,
            city=user.city,
            country=user.country,
        )
    except LlmError:
        parsed = {
            "reply": "I'm having trouble thinking right now — give me a moment and try again.",
            "chips": ["Try again"],
            "action": None,
        }

    reply: str = parsed["reply"]
    chips = parsed["chips"]
    action = parsed["action"] or {}
    action_type = action.get("type")

    outfit = None
    outfit_item_ids: list[str] | None = None
    results = None
    search_query = None
    currency = "USD"
    no_local = False

    if action_type in ("outfit", "mix"):
        ids = _parse_item_ids(action.get("item_ids") or [])
        if ids:
            try:
                items = await fetch_owned_items(db, user.id, ids)
                validate_combo(items)
                outfit = await create_outfit(
                    db,
                    user.id,
                    [i.id for i in items],
                    source="llm",
                    prompt=prompt,
                    reasoning=reply,
                )
                outfit_item_ids = [str(i.id) for i in items]
            except OutfitValidationError:
                reply += " Hmm, I couldn't finalize that exact combo from your closet — want me to try another one?"
                chips = chips or ["Try again"]

    if action_type in ("shop", "mix"):
        search = action.get("search") or {}
        query = str(search.get("query") or "").strip()
        if query:
            search_query = query
            budget_max = search.get("budget_max")
            budget_max = (
                float(budget_max)
                if isinstance(budget_max, (int, float)) and budget_max > 0
                else None
            )
            category = search.get("category")
            if category not in ("tops", "bottoms", "dresses"):
                category = None
            product_result = await shopping.search_products(
                query=query,
                budget_max=budget_max,
                category=category,
                country=user.country,
                city=user.city,
                lat=user.lat,
                lng=user.lng,
            )
            results = product_result["results"]
            currency = product_result["currency"]
            no_local = product_result["no_local"]

    db.add(StylistMessage(user_id=user.id, role="user", content=prompt))
    db.add(
        StylistMessage(
            user_id=user.id,
            role="assistant",
            content=reply,
            outfit_id=outfit.id if outfit else None,
        )
    )
    await db.commit()

    return {
        "reply": reply,
        "chips": chips,
        "outfit": outfit,
        "outfit_item_ids": outfit_item_ids,
        "results": results,
        "search_query": search_query,
        "currency": currency,
        "no_local": no_local,
    }
