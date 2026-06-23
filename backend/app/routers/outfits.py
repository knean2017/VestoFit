import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.outfit import Outfit
from app.models.user import User
from app.models.wardrobe_item import WardrobeItem
from app.routers.wardrobe import _serialize as serialize_wardrobe_item
from app.schemas.outfit import OutfitCreate, OutfitRenderResponse, OutfitResponse
from app.services.outfit_render_service import run_outfit_render
from app.services.outfit_service import (
    OutfitValidationError,
    create_outfit,
    http_validation_error,
)
from app.services.storage import get_storage

router = APIRouter(prefix="/outfits", tags=["outfits"])


async def _serialize_outfit(db: AsyncSession, outfit: Outfit) -> OutfitResponse:
    storage = get_storage()
    res = await db.execute(
        select(WardrobeItem).where(WardrobeItem.id.in_(outfit.item_ids))
    )
    by_id = {i.id: i for i in res.scalars().all()}
    items = [
        await serialize_wardrobe_item(by_id[i])
        for i in outfit.item_ids
        if i in by_id
    ]
    result_url = (
        await storage.public_url(outfit.result_key) if outfit.result_key else None
    )
    return OutfitResponse(
        id=str(outfit.id),
        prompt=outfit.prompt,
        reasoning=outfit.reasoning,
        item_ids=[str(i) for i in outfit.item_ids],
        source=outfit.source,  # type: ignore[arg-type]
        items=items,
        result_url=result_url,
        render_status=outfit.render_status,  # type: ignore[arg-type]
        error_message=outfit.error_message,
        created_at=outfit.created_at,
    )


async def _get_owned(
    db: AsyncSession, user_id: uuid.UUID, outfit_id: uuid.UUID
) -> Outfit:
    res = await db.execute(
        select(Outfit).where(Outfit.id == outfit_id, Outfit.user_id == user_id)
    )
    outfit = res.scalar_one_or_none()
    if outfit is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Outfit not found")
    return outfit


@router.post("", response_model=OutfitResponse)
async def create_manual_outfit(
    payload: OutfitCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    try:
        ids = [uuid.UUID(i) for i in payload.item_ids]
        outfit = await create_outfit(db, user.id, ids, source="manual")
    except OutfitValidationError as e:
        raise http_validation_error(e) from e
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid item id") from e
    return await _serialize_outfit(db, outfit)


@router.get("", response_model=list[OutfitResponse])
async def list_outfits(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(
        select(Outfit)
        .where(Outfit.user_id == user.id)
        .order_by(Outfit.created_at.desc())
    )
    outfits = res.scalars().all()
    return [await _serialize_outfit(db, o) for o in outfits]


@router.get("/{outfit_id}", response_model=OutfitResponse)
async def get_outfit(
    outfit_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    outfit = await _get_owned(db, user.id, outfit_id)
    return await _serialize_outfit(db, outfit)


@router.post("/{outfit_id}/render", response_model=OutfitRenderResponse)
async def render_outfit(
    outfit_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    outfit = await _get_owned(db, user.id, outfit_id)
    if outfit.render_status == "rendering":
        raise HTTPException(status.HTTP_409_CONFLICT, "Render already in progress")
    outfit.render_status = "rendering"
    outfit.error_message = None
    await db.commit()
    background_tasks.add_task(run_outfit_render, outfit.id)
    return OutfitRenderResponse(outfit_id=str(outfit.id), render_status="rendering")
