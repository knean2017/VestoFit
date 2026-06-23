from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_env: Literal["dev", "prod"] = "dev"
    cors_origins: str = "http://localhost:3000"

    database_url: str = "postgresql+asyncpg://fitme:fitme@db:5432/fitme"

    jwt_secret_key: str = "change-me-to-a-long-random-string-at-least-32-chars"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080

    storage_backend: Literal["local", "r2"] = "local"
    storage_local_dir: str = "./.storage"
    storage_public_base_url: str = "http://localhost:8000/files"

    r2_account_id: str = ""
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = "fitme-assets"
    r2_public_url: str = ""

    fal_key: str = ""
    fal_tryon_model: str = "fal-ai/kling/v1-5/kolors-virtual-try-on"
    fal_avatar_model: str = "fal-ai/flux-pro/kontext"

    llm_provider: Literal["gemini", "openai"] = "gemini"
    llm_model: str = "gemini-2.5-flash-lite"
    gemini_api_key: str = ""
    openai_api_key: str = ""

    serpapi_key: str = ""

    lemonsqueezy_api_key: str = ""
    lemonsqueezy_store_id: str = ""
    lemonsqueezy_webhook_secret: str = ""
    frontend_url: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
