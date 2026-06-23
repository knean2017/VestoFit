from abc import ABC, abstractmethod


class StorageService(ABC):
    """Abstract object storage. Implementations: LocalStorage, R2Storage."""

    @abstractmethod
    async def save_bytes(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        """Persist bytes under key. Returns a publicly-fetchable URL."""

    @abstractmethod
    async def read_bytes(self, key: str) -> bytes:
        ...

    @abstractmethod
    async def public_url(self, key: str) -> str:
        ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        ...
