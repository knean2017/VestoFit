from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.avatar import Avatar
from app.models.user import User
from app.schemas.avatar import AvatarResponse
from app.services.avatar_service import create_or_replace_avatar
from app.services.storage import get_storage

router = APIRouter(prefix="/avatar", tags=["avatar"])


async def _serialize(avatar: Avatar) -> AvatarResponse:
    storage = get_storage()
    return AvatarResponse(
        avatar_id=str(avatar.id),
        photo_url=await storage.public_url(avatar.photo_key),
    )


@router.post("/upload", response_model=AvatarResponse)
async def upload(
    photo: Annotated[UploadFile, File(...)],
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if photo.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only JPEG, PNG, or WebP images allowed")
    data = await photo.read(10 * 1024 * 1024 + 1)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty file")
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large (max 10 MB)")
    avatar = await create_or_replace_avatar(
        db, user.id, photo.filename or "photo.jpg", data
    )
    return await _serialize(avatar)


@router.get("/me", response_model=AvatarResponse)
async def get_me(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(select(Avatar).where(Avatar.user_id == user.id))
    avatar = res.scalar_one_or_none()
    if avatar is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No avatar yet")
    return await _serialize(avatar)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(select(Avatar).where(Avatar.user_id == user.id))
    for av in res.scalars().all():
        await db.delete(av)
    await db.commit()
