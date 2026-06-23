import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.wardrobe_item import WardrobeItem
from app.services.garment_service import clean_garment
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


async def create_item(
    db: AsyncSession,
    user_id: uuid.UUID,
    filename: str,
    data: bytes,
    category: str,
) -> WardrobeItem:
    storage = get_storage()
    ext = _ext(filename)

    image_key = f"wardrobe/{user_id}/{uuid.uuid4().hex}{ext}"
    await storage.save_bytes(image_key, data, content_type=_mime(ext))

    cleaned = await clean_garment(data)
    clean_key = f"wardrobe/{user_id}/{uuid.uuid4().hex}.png"
    await storage.save_bytes(clean_key, cleaned, content_type="image/png")

    item = WardrobeItem(
        user_id=user_id,
        image_key=image_key,
        clean_image_key=clean_key,
        category=category,
        tagging_status="pending",
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item
