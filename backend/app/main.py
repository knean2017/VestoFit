from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

import app.models  # noqa: F401 — ensure ORM mappers register
from app.config import get_settings
from app.database import Base, engine
from app.db_migrate import run_migrations
from app.routers import auth, avatar, billing, files, outfits, settings, shopping, stylist, tryon, wardrobe

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
app.include_router(shopping.router)
app.include_router(billing.router)


async def _db_ok() -> bool:
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


@app.get("/health", tags=["ops"])
async def health():
    db_up = await _db_ok()
    body = {"status": "ok" if db_up else "degraded", "db": db_up}
    return JSONResponse(body, status_code=200 if db_up else 503)
