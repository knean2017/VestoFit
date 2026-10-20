import logging

from app.services import email_service
from app.services.email_service import send_email


async def test_console_backend_logs_when_no_smtp_host(monkeypatch, caplog):
    monkeypatch.setattr(email_service._settings, "smtp_host", "")
    with caplog.at_level(logging.INFO, logger="vestofit.email"):
        await send_email("user@example.com", "Reset your password", "click here: http://x")
    joined = " ".join(r.getMessage() for r in caplog.records)
    assert "user@example.com" in joined
    assert "http://x" in joined


async def test_smtp_backend_called_when_host_set(monkeypatch):
    sent = {}

    async def fake_smtp_send(message, hostname, port, username, password, start_tls):
        sent["hostname"] = hostname
        sent["to"] = message["To"]
        sent["subject"] = message["Subject"]

    monkeypatch.setattr(email_service._settings, "smtp_host", "smtp.example.com")
    monkeypatch.setattr(email_service._settings, "smtp_user", "u")
    monkeypatch.setattr(email_service._settings, "smtp_password", "p")
    monkeypatch.setattr(email_service, "_smtp_send", fake_smtp_send)
    await send_email("user@example.com", "Hello", "body")
    assert sent["hostname"] == "smtp.example.com"
    assert sent["to"] == "user@example.com"
    assert sent["subject"] == "Hello"
