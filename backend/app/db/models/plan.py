from datetime import date, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text, UniqueConstraint, false
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UuidPkMixin, pg_enum
from app.domain.plan import Audience, Confirmation, ItemStatus, Stage, WaitingReason


class PlanTemplateItem(UuidPkMixin, TimestampMixin, Base):
    """One checklist line; plans of interns are instantiated from these rows."""

    __tablename__ = "plan_template_items"

    slug: Mapped[str] = mapped_column(String(100), unique=True)
    track: Mapped[str] = mapped_column(String(32), default="all", server_default="all")
    stage: Mapped[Stage] = mapped_column(pg_enum(Stage, "plan_stage"))
    position: Mapped[int] = mapped_column(default=0, server_default="0")
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    category: Mapped[str] = mapped_column(String(32), default="org", server_default="org")
    audience: Mapped[Audience] = mapped_column(
        pg_enum(Audience, "plan_audience"),
        default=Audience.INTERN,
        server_default=Audience.INTERN.value,
    )
    confirmation: Mapped[Confirmation] = mapped_column(
        pg_enum(Confirmation, "plan_confirmation"),
        default=Confirmation.SELF,
        server_default=Confirmation.SELF.value,
    )
    action: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    quiz: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)
    doc_slugs: Mapped[list[str]] = mapped_column(
        ARRAY(String(100)), default=list, server_default="{}"
    )
    needs_laptop: Mapped[bool] = mapped_column(default=False, server_default=false())
    source: Mapped[str] = mapped_column(
        String(200), default="Чек-лист Авито (тестовые данные)", server_default=""
    )


class PlanItem(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "plan_items"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    template_item_id: Mapped[UUID] = mapped_column(
        ForeignKey("plan_template_items.id", ondelete="CASCADE")
    )
    status: Mapped[ItemStatus] = mapped_column(
        pg_enum(ItemStatus, "plan_item_status"),
        default=ItemStatus.TODO,
        server_default=ItemStatus.TODO.value,
    )
    due_date: Mapped[date]
    started_at: Mapped[datetime | None]
    completed_at: Mapped[datetime | None]
    waiting_reason: Mapped[WaitingReason | None] = mapped_column(
        pg_enum(WaitingReason, "plan_waiting_reason")
    )
    blocked_reason: Mapped[str | None] = mapped_column(String(500))
    review_comment: Mapped[str | None] = mapped_column(String(1000))
    request_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("service_requests.id", ondelete="SET NULL", use_alter=True)
    )
    confirmed_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    __table_args__ = (
        UniqueConstraint("user_id", "template_item_id", name="uq_plan_items_user_template"),
        Index("ix_plan_items_user_status", "user_id", "status"),
    )
