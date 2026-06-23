import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.subscription import CheckoutRequest, CheckoutResponse, SubscriptionStatus
from app.services.payment_service import (
    create_checkout,
    get_user_subscription,
    handle_subscription_event,
    verify_webhook_signature,
)

router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    payload: CheckoutRequest,
    user: Annotated[User, Depends(get_current_user)],
):
    try:
        url = await create_checkout(
            user_id=user.id,
            user_email=user.email,
            variant_id=payload.variant_id,
        )
    except Exception:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            "Payment service unavailable",
        )
    return CheckoutResponse(checkout_url=url)


@router.get("/subscription", response_model=SubscriptionStatus)
async def subscription_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    sub = await get_user_subscription(db, user.id)
    if sub is None:
        return SubscriptionStatus(is_active=False)
    return SubscriptionStatus(
        is_active=sub.is_active,
        plan=sub.plan,
        status=sub.status,
        card_brand=sub.card_brand,
        card_last_four=sub.card_last_four,
        renews_at=sub.renews_at,
        ends_at=sub.ends_at,
        update_payment_url=sub.update_payment_url,
        customer_portal_url=sub.customer_portal_url,
    )


@router.post("/webhook", status_code=200)
async def webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    body = await request.body()
    signature = request.headers.get("x-signature", "")

    if not signature or not verify_webhook_signature(body, signature):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid signature")

    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid JSON")

    event_name = data.get("meta", {}).get("event_name", "")
    custom_data = data.get("meta", {}).get("custom_data", {})

    handled_events = {
        "subscription_created",
        "subscription_updated",
        "subscription_cancelled",
        "subscription_expired",
        "subscription_resumed",
        "subscription_paused",
    }

    if event_name in handled_events:
        await handle_subscription_event(
            db=db,
            event_name=event_name,
            subscription_data=data.get("data", {}),
            custom_data=custom_data,
        )

    return {"received": True}
