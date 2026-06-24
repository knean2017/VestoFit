import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.stylist_message import StylistMessage
from app.models.user import User
from app.schemas.stylist import (
    StylistAskRequest,
    StylistAskResponse,
    StylistMessageResponse,
    StylistRerollRequest,
    StylistSuggestRequest,
    StylistSuggestResponse,
)
from app.services.outfit_service import OutfitValidationError, http_validation_error
from app.services.stylist_service import ask_stylist, suggest_outfit

router = APIRouter(prefix="/stylist", tags=["stylist"])


@router.post("/suggest", response_model=StylistSuggestResponse)
async def suggest(
    payload: StylistSuggestRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    try:
        locked = [uuid.UUID(i) for i in payload.locked_item_ids]
        outfit, ids, reasoning, decline = await suggest_outfit(
            db, user.id, payload.prompt, locked
        )
    except OutfitValidationError as e:
        raise http_validation_error(e) from e
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid item id") from e

    if decline or outfit is None:
        return StylistSuggestResponse(
            outfit_id="",
            item_ids=[str(i) for i in ids],
            reasoning=reasoning,
            decline=True,
        )

    return StylistSuggestResponse(
        outfit_id=str(outfit.id),
        item_ids=[str(i) for i in ids],
        reasoning=reasoning,
        decline=False,
    )


@router.post("/reroll", response_model=StylistSuggestResponse)
async def reroll(
    payload: StylistRerollRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    try:
        locked = [uuid.UUID(i) for i in payload.locked_item_ids]
        outfit, ids, reasoning, decline = await suggest_outfit(
            db, user.id, payload.prompt, locked
        )
    except OutfitValidationError as e:
        raise http_validation_error(e) from e
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid item id") from e

    if decline or outfit is None:
        return StylistSuggestResponse(
            outfit_id="",
            item_ids=[str(i) for i in ids],
            reasoning=reasoning,
            decline=True,
        )

    return StylistSuggestResponse(
        outfit_id=str(outfit.id),
        item_ids=[str(i) for i in ids],
        reasoning=reasoning,
        decline=False,
    )


@router.post("/ask", response_model=StylistAskResponse)
async def ask(
    payload: StylistAskRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    try:
        item_ids = [uuid.UUID(i) for i in payload.item_ids] if payload.item_ids else None
        result = await ask_stylist(db, user.id, payload.prompt, item_ids)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid item id") from e
    return StylistAskResponse(reply=result["reply"], chips=result.get("chips"))


@router.get("/messages", response_model=list[StylistMessageResponse])
async def list_messages(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(
        select(StylistMessage)
        .where(StylistMessage.user_id == user.id)
        .order_by(StylistMessage.created_at.asc())
        .limit(100)
    )
    return [
        StylistMessageResponse(
            id=str(m.id),
            role=m.role,
            content=m.content,
            outfit_id=str(m.outfit_id) if m.outfit_id else None,
            created_at=m.created_at.isoformat(),
        )
        for m in res.scalars().all()
    ]
