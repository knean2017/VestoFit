import logging

import pytest

from app.services import llm_service
from app.services.llm_service import LlmError


class FakeResponse:
    status_code = 503
    text = '{"error": {"status": "UNAVAILABLE"}}'

    def json(self):
        return {}


class FakeClient:
    def __init__(self, *a, **k): ...

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, **kwargs):
        return FakeResponse()


async def test_gemini_failure_is_logged_with_status_and_model(monkeypatch, caplog):
    monkeypatch.setattr(llm_service.httpx, "AsyncClient", FakeClient)
    monkeypatch.setattr(llm_service._settings, "gemini_api_key", "k")

    async def no_sleep(_s):
        return None

    monkeypatch.setattr(llm_service.asyncio, "sleep", no_sleep)

    with caplog.at_level(logging.WARNING, logger="fitme.llm"):
        with pytest.raises(LlmError):
            await llm_service._gemini_generate([{"text": "hi"}], json_mode=False)

    joined = " ".join(r.message for r in caplog.records)
    assert "503" in joined
    assert llm_service._settings.llm_model in joined
