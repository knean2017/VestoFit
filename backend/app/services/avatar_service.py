import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.avatar import Avatar
from app.services.storage import get_storage

_ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}


def _ext(name: str) -> str:
    if "." not in name:
        return ".jpg"
    ext = "." + name.rsplit(".", 1)[-1].lower()
    return ext if ext in _ALLOWED_EXT else ".jpg"


def _mime(ext: str) -> str:
    return {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(ext, "image/jpeg")


async def create_or_replace_avatar(
    db: AsyncSession,
    user_id: uuid.UUID,
    filename: str,
    data: bytes,
) -> Avatar:
    """Store one photo as the user's avatar. Replaces any existing avatar."""
    storage = get_storage()
    ext = _ext(filename)
    key = f"avatars/{user_id}/{uuid.uuid4().hex}{ext}"
    await storage.save_bytes(key, data, content_type=_mime(ext))

    result = await db.execute(
        __import__("sqlalchemy", fromlist=["select"]).select(Avatar).where(
            Avatar.user_id == user_id
        )
    )
    avatar = result.scalar_one_or_none()

    if avatar:
        avatar.photo_key = key
    else:
        avatar = Avatar(user_id=user_id, photo_key=key)
        db.add(avatar)

    await db.commit()
    await db.refresh(avatar)
    return avatar
