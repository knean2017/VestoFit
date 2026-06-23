import hashlib
import hmac
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.subscription import Subscription

LS_API = "https://api.lemonsqueezy.com/v1"


def _headers() -> dict[str, str]:
    settings = get_settings()
    return {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        "Authorization": f"Bearer {settings.lemonsqueezy_api_key}",
    }


async def create_checkout(
    user_id: uuid.UUID,
    user_email: str,
    variant_id: str,
) -> str:
    settings = get_settings()
    payload = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_data": {
                    "email": user_email,
                    "custom": {"user_id": str(user_id)},
                },
                "product_options": {
                    "redirect_url": f"{settings.frontend_url}/settings?payment=success",
                },
            },
            "relationships": {
                "store": {
                    "data": {"type": "stores", "id": settings.lemonsqueezy_store_id}
                },
                "variant": {
                    "data": {"type": "variants", "id": variant_id}
                },
            },
        }
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(f"{LS_API}/checkouts", json=payload, headers=_headers())
        resp.raise_for_status()
        data = resp.json()

    return data["data"]["attributes"]["url"]


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    settings = get_settings()
    digest = hmac.new(
        settings.lemonsqueezy_webhook_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(digest, signature)


async def handle_subscription_event(
    db: AsyncSession,
    event_name: str,
    subscription_data: dict,
    custom_data: dict,
) -> None:
    user_id_str = custom_data.get("user_id")
    if not user_id_str:
        return

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        return

    ls_sub_id = str(subscription_data.get("id", ""))
    attrs = subscription_data.get("attributes", {})

    res = await db.execute(
        select(Subscription).where(Subscription.ls_subscription_id == ls_sub_id)
    )
    sub = res.scalar_one_or_none()

    if event_name == "subscription_created" and sub is None:
        urls = attrs.get("urls", {})
        sub = Subscription(
            user_id=user_id,
            ls_subscription_id=ls_sub_id,
            ls_customer_id=attrs.get("customer_id", 0),
            ls_order_id=attrs.get("order_id", 0),
            ls_variant_id=attrs.get("variant_id", 0),
            status=attrs.get("status", "active"),
            plan="pro",
            card_brand=attrs.get("card_brand"),
            card_last_four=attrs.get("card_last_four"),
            renews_at=attrs.get("renews_at"),
            ends_at=attrs.get("ends_at"),
            update_payment_url=urls.get("update_payment_method"),
            customer_portal_url=urls.get("customer_portal"),
            is_active=attrs.get("status") == "active",
        )
        db.add(sub)
    elif sub is not None:
        sub.status = attrs.get("status", sub.status)
        sub.is_active = attrs.get("status") in ("active", "on_trial")
        sub.card_brand = attrs.get("card_brand", sub.card_brand)
        sub.card_last_four = attrs.get("card_last_four", sub.card_last_four)
        sub.renews_at = attrs.get("renews_at", sub.renews_at)
        sub.ends_at = attrs.get("ends_at", sub.ends_at)
        urls = attrs.get("urls", {})
        if urls.get("update_payment_method"):
            sub.update_payment_url = urls["update_payment_method"]
        if urls.get("customer_portal"):
            sub.customer_portal_url = urls["customer_portal"]

    await db.commit()


async def get_user_subscription(
    db: AsyncSession, user_id: uuid.UUID
) -> Subscription | None:
    res = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    return res.scalar_one_or_none()
