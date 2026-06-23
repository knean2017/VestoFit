import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    ls_subscription_id: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    ls_customer_id: Mapped[int] = mapped_column(Integer, nullable=False)
    ls_order_id: Mapped[int] = mapped_column(Integer, nullable=False)
    ls_variant_id: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    plan: Mapped[str] = mapped_column(String, nullable=False, default="pro")
    card_brand: Mapped[str | None] = mapped_column(String, nullable=True)
    card_last_four: Mapped[str | None] = mapped_column(String, nullable=True)
    renews_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    update_payment_url: Mapped[str | None] = mapped_column(String, nullable=True)
    customer_portal_url: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
