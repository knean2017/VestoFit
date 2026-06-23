"""Local-storage file server. Only mounted when STORAGE_BACKEND=local.

In production with R2, public_url() returns the R2 CDN URL and this
endpoint is unused (and explicitly disabled).
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import get_settings

router = APIRouter(prefix="/files", tags=["files"])
_settings = get_settings()


@router.get("/{key:path}")
async def serve(key: str):
    if _settings.storage_backend != "local":
        raise HTTPException(404, "Not available in this storage mode")

    root = Path(_settings.storage_local_dir).resolve()
    p = (root / key).resolve()
    if not str(p).startswith(str(root)) or not p.is_file():
        raise HTTPException(404, "Not found")
    return FileResponse(p)
