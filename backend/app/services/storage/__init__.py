from app.config import get_settings
from app.services.storage.base import StorageService
from app.services.storage.local import LocalStorage
from app.services.storage.r2 import R2Storage

_singleton: StorageService | None = None


def get_storage() -> StorageService:
    global _singleton
    if _singleton is None:
        backend = get_settings().storage_backend
        _singleton = R2Storage() if backend == "r2" else LocalStorage()
    return _singleton


__all__ = ["StorageService", "get_storage"]
