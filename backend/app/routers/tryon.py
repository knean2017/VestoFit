import uuid
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.avatar import Avatar
from app.models.job import TryOnJob
from app.models.user import User
from app.models.wardrobe_item import WardrobeItem
from app.schemas.tryon import Category, TryOnJobResponse, TryOnOutfitRequest, TryOnStatus, TryOnUrlRequest
from app.services.garment_service import infer_category as _infer_category
from app.services.garment_service import clean_garment
from app.services.quota_service import QuotaExceededError, ensure_render_allowed
from app.services.storage import get_storage
from app.services.tryon_service import run_tryon_job, run_outfit_job

router = APIRouter(prefix="/tryon", tags=["tryon"])


async def _get_avatar(db: AsyncSession, user_id: uuid.UUID) -> Avatar:
    res = await db.execute(select(Avatar).where(Avatar.user_id == user_id))
    avatar = res.scalar_one_or_none()
    if avatar is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Please upload your avatar photos first",
        )
    return avatar


async def _check_quota(db: AsyncSession, user_id: uuid.UUID) -> None:
    try:
        await ensure_render_allowed(db, user_id)
    except QuotaExceededError as e:
        raise HTTPException(status.HTTP_402_PAYMENT_REQUIRED, str(e)) from e


async def _serialize(job: TryOnJob) -> TryOnStatus:
    storage = get_storage()
    return TryOnStatus(
        job_id=str(job.id),
        status=job.status,  # type: ignore[arg-type]
        result_url=(
            await storage.public_url(job.result_key) if job.result_key else None
        ),
        garment_url=(
            await storage.public_url(job.garment_key) if job.garment_key else None
        ),
        source_url=job.source_url,
        category=job.category,  # type: ignore[arg-type]
        error=job.error_message,
        created_at=job.created_at,
    )


@router.post("/url", response_model=TryOnJobResponse)
async def tryon_url(
    payload: TryOnUrlRequest,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    await _check_quota(db, user.id)
    avatar = await _get_avatar(db, user.id)
    auto_cat = _infer_category(str(payload.garment_url), payload.description)
    job = TryOnJob(
        user_id=user.id,
        avatar_id=avatar.id,
        source_url=str(payload.garment_url),
        category=payload.category or auto_cat,
        description=payload.description,
        status="queued",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    background.add_task(run_tryon_job, job.id)
    return TryOnJobResponse(job_id=str(job.id), status=job.status)  # type: ignore[arg-type]


@router.post("/upload", response_model=TryOnJobResponse)
async def tryon_upload(
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    garment_image: Annotated[UploadFile, File(...)],
    category: Annotated[Category | None, Form()] = None,
    description: Annotated[str | None, Form()] = None,
):
    await _check_quota(db, user.id)
    avatar = await _get_avatar(db, user.id)
    if garment_image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only JPEG, PNG, or WebP images allowed")
    data = await garment_image.read(10 * 1024 * 1024 + 1)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty image")
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large (max 10 MB)")

    storage = get_storage()
    cleaned = await clean_garment(data)
    key = f"garments/{user.id}/{uuid.uuid4().hex}.png"
    await storage.save_bytes(key, cleaned, "image/png")

    auto_cat = _infer_category(None, description)
    job = TryOnJob(
        user_id=user.id,
        avatar_id=avatar.id,
        garment_key=key,
        category=category or auto_cat,
        description=description,
        status="queued",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    background.add_task(run_tryon_job, job.id)
    return TryOnJobResponse(job_id=str(job.id), status=job.status)  # type: ignore[arg-type]


@router.post("/outfit", response_model=TryOnJobResponse)
async def tryon_outfit(
    payload: TryOnOutfitRequest,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    await _check_quota(db, user.id)
    if not payload.item_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No item IDs provided")
    if len(payload.item_ids) > 6:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Maximum 6 items per outfit")
    avatar = await _get_avatar(db, user.id)
    parsed_ids = []
    for raw in payload.item_ids:
        try:
            parsed_ids.append(uuid.UUID(raw))
        except ValueError:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Invalid item ID: {raw}")
    res = await db.execute(
        select(WardrobeItem).where(
            WardrobeItem.id.in_(parsed_ids),
            WardrobeItem.user_id == user.id,
        )
    )
    found = list(res.scalars().all())
    if not found:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No matching wardrobe items")
    validated_ids = [item.id for item in found]
    job = TryOnJob(
        user_id=user.id,
        avatar_id=avatar.id,
        category=found[0].category,
        description=f"Full outfit: {len(found)} items",
        status="queued",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    background.add_task(run_outfit_job, job.id, validated_ids)
    return TryOnJobResponse(job_id=str(job.id), status=job.status)  # type: ignore[arg-type]


@router.get("/history", response_model=list[TryOnStatus])
async def history(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(
        select(TryOnJob)
        .where(TryOnJob.user_id == user.id)
        .order_by(TryOnJob.created_at.desc())
        .limit(50)
    )
    return [await _serialize(j) for j in res.scalars().all()]


@router.get("/{job_id}", response_model=TryOnStatus)
async def get_status(
    job_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    res = await db.execute(
        select(TryOnJob).where(TryOnJob.id == job_id, TryOnJob.user_id == user.id)
    )
    job = res.scalar_one_or_none()
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")
    return await _serialize(job)
