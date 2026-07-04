from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.rate_limit import rate_limit_auth
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserMe,
    UserUpdateRequest,
)
from app.services.auth_service import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.services.password_reset_service import (
    ResetTokenError,
    request_reset,
    reset_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, dependencies=[Depends(rate_limit_auth)])
async def register(
    payload: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    exists = await db.execute(select(User).where(User.email == payload.email))
    if exists.scalar_one_or_none():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Email already registered")

    user = User(email=payload.email, hashed_password=hash_password(payload.password))
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(rate_limit_auth)])
async def login(
    payload: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    res = await db.execute(select(User).where(User.email == payload.email))
    user = res.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post(
    "/forgot",
    response_model=MessageResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(rate_limit_auth)],
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    await request_reset(db, payload.email)
    return MessageResponse(message="If that account exists, a reset link is on its way.")


@router.post(
    "/reset",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit_auth)],
)
async def do_reset_password(
    payload: ResetPasswordRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        await reset_password(db, payload.token, payload.password)
    except ResetTokenError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e)) from e
    return MessageResponse(message="Password updated — you can sign in now.")


@router.get("/me", response_model=UserMe)
async def me(user: Annotated[User, Depends(get_current_user)]):
    return UserMe(
        id=str(user.id),
        email=user.email,
        country=user.country,
        city=user.city,
        lat=user.lat,
        lng=user.lng,
    )


@router.patch("/me", response_model=UserMe)
async def update_me(
    payload: UserUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if payload.country is not None:
        user.country = payload.country
    if payload.city is not None:
        user.city = payload.city
    if payload.lat is not None:
        user.lat = payload.lat
    if payload.lng is not None:
        user.lng = payload.lng
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserMe(
        id=str(user.id),
        email=user.email,
        country=user.country,
        city=user.city,
        lat=user.lat,
        lng=user.lng,
    )
