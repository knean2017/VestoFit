import asyncio
import os
from pathlib import Path

from app.config import get_settings
from app.services.storage.base import StorageService

_settings = get_settings()


class LocalStorage(StorageService):
    def __init__(self) -> None:
        self.root = Path(_settings.storage_local_dir).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.base_url = _settings.storage_public_base_url.rstrip("/")

    def _path(self, key: str) -> Path:
        key = key.lstrip("/")
        p = (self.root / key).resolve()
        if not str(p).startswith(str(self.root)):
            raise ValueError("Invalid storage key")
        return p

    async def save_bytes(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(p.write_bytes, data)
        return await self.public_url(key)

    async def read_bytes(self, key: str) -> bytes:
        return await asyncio.to_thread(self._path(key).read_bytes)

    async def public_url(self, key: str) -> str:
        return f"{self.base_url}/{key.lstrip('/')}"

    async def delete(self, key: str) -> None:
        p = self._path(key)
        if p.exists():
            await asyncio.to_thread(os.remove, p)
