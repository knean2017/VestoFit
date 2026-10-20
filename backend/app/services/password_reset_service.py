"""Password reset — single-use, hashed, 30-minute tokens."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.services.auth_service import hash_password

_TOKEN_TTL = timedelta(minutes=30)


class ResetTokenError(RuntimeError):
    pass


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def _get_user_by_email(db: AsyncSession, email: str) -> User | None:
    res = await db.execute(select(User).where(User.email == email))
    return res.scalar_one_or_none()


async def _get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    res = await db.execute(select(User).where(User.id == user_id))
    return res.scalar_one_or_none()


async def _invalidate_tokens(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user_id, PasswordResetToken.used_at.is_(None))
        .values(used_at=datetime.now(timezone.utc))
    )


async def _get_valid_token(db: AsyncSession, token_hash: str) -> PasswordResetToken | None:
    res = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
    )
    return res.scalar_one_or_none()


async def request_reset(db: AsyncSession, email: str) -> None:
    import app.services.email_service as email_svc

    user = await _get_user_by_email(db, email)
    if user is None:
        return  # never reveal whether the account exists

    await _invalidate_tokens(db, user.id)
    raw = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_hash_token(raw),
            expires_at=datetime.now(timezone.utc) + _TOKEN_TTL,
        )
    )
    await db.commit()

    link = f"{get_settings().frontend_url}/reset-password?token={raw}"
    await email_svc.send_email(
        user.email,
        "Reset your VestoFit password",
        "Someone (hopefully you) asked to reset your VestoFit password.\n\n"
        f"Reset code (paste it in the app): {raw}\n\n"
        f"Or reset in the browser (valid 30 minutes): {link}\n\n"
        "If this wasn't you, ignore this email — your password is unchanged.",
    )


async def reset_password(db: AsyncSession, token: str, new_password: str) -> None:
    row = await _get_valid_token(db, _hash_token(token))
    if row is None:
        raise ResetTokenError("This reset link is invalid or has expired")

    user = await _get_user_by_id(db, row.user_id)
    if user is None:
        raise ResetTokenError("This reset link is invalid or has expired")

    user.hashed_password = hash_password(new_password)
    row.used_at = datetime.now(timezone.utc)
    await db.commit()
