"""Outbound email — SMTP when configured, console logging otherwise."""

from __future__ import annotations

import logging
from email.message import EmailMessage

from app.config import get_settings

_settings = get_settings()
_log = logging.getLogger("fitme.email")


async def _smtp_send(message, hostname, port, username, password, start_tls):
    import aiosmtplib

    await aiosmtplib.send(
        message,
        hostname=hostname,
        port=port,
        username=username or None,
        password=password or None,
        start_tls=start_tls,
    )


async def send_email(to: str, subject: str, body: str) -> None:
    if not _settings.smtp_host:
        _log.info("EMAIL (console backend) to=%s subject=%r\n%s", to, subject, body)
        return

    message = EmailMessage()
    message["From"] = _settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)
    await _smtp_send(
        message,
        hostname=_settings.smtp_host,
        port=_settings.smtp_port,
        username=_settings.smtp_user,
        password=_settings.smtp_password,
        start_tls=True,
    )
