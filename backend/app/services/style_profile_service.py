"""Style profile — fashion-only attributes analyzed from the user's avatar photo."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.avatar import Avatar
from app.models.style_profile import StyleProfile
from app.services.llm_service import LlmError, analyze_style_photo
from app.services.storage import get_storage


class StyleProfileError(RuntimeError):
    pass


async def get_profile(db: AsyncSession, user_id: uuid.UUID) -> StyleProfile | None:
    res = await db.execute(
        select(StyleProfile).where(StyleProfile.user_id == user_id)
    )
    return res.scalar_one_or_none()


async def get_profile_data(db: AsyncSession, user_id: uuid.UUID) -> dict | None:
    profile = await get_profile(db, user_id)
    if profile is None:
        return None
    data = dict(profile.data or {})
    if profile.preferences:
        data["user_preferences"] = profile.preferences
    return data or None


async def analyze_from_avatar(db: AsyncSession, user_id: uuid.UUID) -> StyleProfile:
    res = await db.execute(select(Avatar).where(Avatar.user_id == user_id))
    avatar = res.scalar_one_or_none()
    if avatar is None:
        raise StyleProfileError("Upload an avatar photo first")

    photo = await get_storage().read_bytes(avatar.photo_key)
    try:
        data = await analyze_style_photo(photo)
    except LlmError as e:
        raise StyleProfileError("Analysis failed — try again in a moment") from e
    if not data.get("undertone"):
        raise StyleProfileError("Couldn't read style traits from this photo — try a clearer one")

    profile = await get_profile(db, user_id)
    if profile is None:
        profile = StyleProfile(user_id=user_id, data=data)
        db.add(profile)
    else:
        profile.data = data
    await db.commit()
    await db.refresh(profile)
    return profile


async def update_preferences(
    db: AsyncSession, user_id: uuid.UUID, preferences: str
) -> StyleProfile:
    profile = await get_profile(db, user_id)
    if profile is None:
        profile = StyleProfile(user_id=user_id, data={}, preferences=preferences)
        db.add(profile)
    else:
        profile.preferences = preferences
    await db.commit()
    await db.refresh(profile)
    return profile


async def delete_profile(db: AsyncSession, user_id: uuid.UUID) -> None:
    profile = await get_profile(db, user_id)
    if profile is not None:
        await db.delete(profile)
        await db.commit()
