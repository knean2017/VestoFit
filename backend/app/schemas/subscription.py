from datetime import datetime

from pydantic import BaseModel


class CheckoutRequest(BaseModel):
    variant_id: str


class CheckoutResponse(BaseModel):
    checkout_url: str


class SubscriptionStatus(BaseModel):
    is_active: bool
    plan: str | None = None
    status: str | None = None
    card_brand: str | None = None
    card_last_four: str | None = None
    renews_at: datetime | None = None
    ends_at: datetime | None = None
    update_payment_url: str | None = None
    customer_portal_url: str | None = None


class RenderUsage(BaseModel):
    plan: str
    limit: int | None = None
    used: int
    remaining: int | None = None
