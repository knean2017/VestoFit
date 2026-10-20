"""Email verification — single-use, hashed, 24-hour 6-digit codes."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.email_verification import EmailVerificationToken
from app.models.user import User

_CODE_TTL = timedelta(hours=24)


class VerificationCodeError(RuntimeError):
    pass


def _hash_code(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def _invalidate_codes(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(EmailVerificationToken)
        .where(
            EmailVerificationToken.user_id == user_id,
            EmailVerificationToken.used_at.is_(None),
        )
        .values(used_at=datetime.now(timezone.utc))
    )


async def _get_valid_code(
    db: AsyncSession, user_id: uuid.UUID, code_hash: str
) -> EmailVerificationToken | None:
    res = await db.execute(
        select(EmailVerificationToken).where(
            EmailVerificationToken.user_id == user_id,
            EmailVerificationToken.code_hash == code_hash,
            EmailVerificationToken.used_at.is_(None),
            EmailVerificationToken.expires_at > datetime.now(timezone.utc),
        )
    )
    return res.scalar_one_or_none()


async def request_verification(db: AsyncSession, user: User) -> None:
    import app.services.email_service as email_svc

    if user.email_verified_at is not None:
        return

    await _invalidate_codes(db, user.id)
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        EmailVerificationToken(
            user_id=user.id,
            code_hash=_hash_code(code),
            expires_at=datetime.now(timezone.utc) + _CODE_TTL,
        )
    )
    await db.commit()

    await email_svc.send_email(
        user.email,
        "Verify your VestoFit email",
        "Welcome to VestoFit! Confirm this email address to unlock try-on renders.\n\n"
        f"Verification code (paste it in the app): {code}\n\n"
        "The code is valid for 24 hours. If you didn't sign up, ignore this email.",
    )


async def verify_email(db: AsyncSession, user: User, code: str) -> None:
    row = await _get_valid_code(db, user.id, _hash_code(code))
    if row is None:
        raise VerificationCodeError("This code is invalid or has expired")

    user.email_verified_at = datetime.now(timezone.utc)
    row.used_at = datetime.now(timezone.utc)
    await db.commit()
