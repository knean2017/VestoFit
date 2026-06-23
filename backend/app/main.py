from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models  # noqa: F401 — ensure ORM mappers register
from app.config import get_settings
from app.database import Base, engine
from app.db_migrate import run_migrations
from app.routers import auth, avatar, files, outfits, settings, stylist, tryon, wardrobe

_settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with engine.begin() as conn:
        await run_migrations(conn)
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="FitMe API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(avatar.router)
app.include_router(tryon.router)
app.include_router(settings.router)
app.include_router(wardrobe.router)
app.include_router(outfits.router)
app.include_router(stylist.router)
app.include_router(files.router)


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "storage": _settings.storage_backend,
        "tryon_model": _settings.fal_tryon_model,
        "avatar_model": _settings.fal_avatar_model,
        "fal_configured": "true" if _settings.fal_key else "false",
        "llm_configured": "true" if _settings.gemini_api_key else "false",
        "llm_model": _settings.llm_model,
    }
