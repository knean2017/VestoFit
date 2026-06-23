import asyncio
from typing import Any

import boto3
from botocore.config import Config

from app.config import get_settings
from app.services.storage.base import StorageService

_settings = get_settings()


class R2Storage(StorageService):
    """Cloudflare R2 (S3-compatible) storage."""

    def __init__(self) -> None:
        self._client: Any = boto3.client(
            "s3",
            endpoint_url=f"https://{_settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=_settings.r2_access_key_id,
            aws_secret_access_key=_settings.r2_secret_access_key,
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )
        self.bucket = _settings.r2_bucket_name
        self.public_base = _settings.r2_public_url.rstrip("/")

    async def save_bytes(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        def _put() -> None:
            self._client.put_object(
                Bucket=self.bucket, Key=key, Body=data, ContentType=content_type
            )

        await asyncio.to_thread(_put)
        return await self.public_url(key)

    async def read_bytes(self, key: str) -> bytes:
        def _get() -> bytes:
            obj = self._client.get_object(Bucket=self.bucket, Key=key)
            return obj["Body"].read()

        return await asyncio.to_thread(_get)

    async def public_url(self, key: str) -> str:
        if self.public_base:
            return f"{self.public_base}/{key.lstrip('/')}"

        def _sign() -> str:
            return self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=3600,
            )

        return await asyncio.to_thread(_sign)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(
            self._client.delete_object, Bucket=self.bucket, Key=key
        )
