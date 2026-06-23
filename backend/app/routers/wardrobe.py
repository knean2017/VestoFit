import uuid
from typing import Annotated, Literal

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.models.wardrobe_item import WardrobeItem
from app.schemas.wardrobe import WardrobeItemResponse, WardrobeItemUpdate
from app.services.storage import get_storage
from app.services.wardrobe_service import create_item
from app.services.wardrobe_tagging_service import tag_wardrobe_item

router = APIRouter(prefix="/wardrobe", tags=["wardrobe"])


async def _serialize(item: WardrobeItem) -> WardrobeItemResponse:
    storage = get_storage()
    return WardrobeItemResponse(
        id=str(item.id),
        category=item.category,  # type: ignore[arg-type]
        image_url=await storage.public_url(item.image_key),
        clean_image_url=(
            await storage.public_url(item.clean_image_key)
            if item.clean_image_key
            else None
        ),
        name=item.name,
        color=item.color,
        pattern=item.pattern,
        formality=item.formality,
        season=item.season,
        warmth=item.warmth,
        user_notes=item.user_notes,
        conditions=item.conditions,
        is_favorite=item.is_favorite,
        tagging_status=item.tagging_status,  # type: ignore[arg-type]
        created_at=item.created_at,
    )


async def _get_owned(
    db: AsyncSession, user_id: uuid.UUID, item_id: uuid.UUID
) -> WardrobeItem:
    res = await db.execute(
        select(WardrobeItem).where(
            WardrobeItem.id == item_id, WardrobeItem.user_id == user_id
        )
    )
    item = res.scalar_one_or_none()
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return item


@router.post("/items", response_model=WardrobeItemResponse)
async def add_item(
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    photo: Annotated[UploadFile, File(...)],
    category: Annotated[Literal["tops", "bottoms", "dresses"], Form()],
):
    if photo.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only JPEG, PNG, or WebP images allowed")
    data = await photo.read(10 * 1024 * 1024 + 1)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large (max 10 MB)")
    item = await create_item(
        db, user.id, photo.filename or "item.jpg", data, category
    )
    background_tasks.add_task(tag_wardrobe_item, item.id)
    return await _serialize(item)


@router.get("/items", response_model=list[WardrobeItemResponse])
async def list_items(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    category: Annotated[str | None, Query()] = None,
    color: Annotated[str | None, Query()] = None,
    season: Annotated[str | None, Query()] = None,
    favorites_only: Annotated[bool, Query()] = False,
):
    q = select(WardrobeItem).where(WardrobeItem.user_id == user.id)
    if category:
        q = q.where(WardrobeItem.category == category)
    if color:
        q = q.where(WardrobeItem.color.ilike(f"%{color}%"))  # type: ignore[union-attr]
    if season:
        q = q.where(WardrobeItem.season == season)
    if favorites_only:
        q = q.where(WardrobeItem.is_favorite.is_(True))
    q = q.order_by(WardrobeItem.created_at.desc())

    res = await db.execute(q)
    return [await _serialize(i) for i in res.scalars().all()]


@router.get("/items/{item_id}", response_model=WardrobeItemResponse)
async def get_item(
    item_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    item = await _get_owned(db, user.id, item_id)
    return await _serialize(item)


@router.patch("/items/{item_id}", response_model=WardrobeItemResponse)
async def update_item(
    item_id: uuid.UUID,
    payload: WardrobeItemUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    item = await _get_owned(db, user.id, item_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return await _serialize(item)


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    item = await _get_owned(db, user.id, item_id)
    await db.delete(item)
    await db.commit()


@router.post("/items/{item_id}/retag", response_model=WardrobeItemResponse)
async def retag_item(
    item_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    item = await _get_owned(db, user.id, item_id)
    item.tagging_status = "pending"
    await db.commit()
    await db.refresh(item)
    background_tasks.add_task(tag_wardrobe_item, item.id)
    return await _serialize(item)
