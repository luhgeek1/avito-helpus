from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UuidPkMixin, pg_enum, utcnow
from app.domain.escalations import EscalationKind, EscalationLevel, EscalationStatus
from app.domain.events import NotificationKind


class Escalation(UuidPkMixin, TimestampMixin, Base):
    """A question Orbi hands to a person, climbing mentor -> lead -> HRBP until answered."""

    __tablename__ = "escalations"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    assignee_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    level: Mapped[EscalationLevel] = mapped_column(pg_enum(EscalationLevel, "escalation_level"))
    kind: Mapped[EscalationKind] = mapped_column(pg_enum(EscalationKind, "escalation_kind"))
    status: Mapped[EscalationStatus] = mapped_column(
        pg_enum(EscalationStatus, "escalation_status"),
        default=EscalationStatus.OPEN,
        server_default=EscalationStatus.OPEN.value,
    )
    question: Mapped[str] = mapped_column(Text)
    context: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    answer: Mapped[str | None] = mapped_column(Text)
    answered_by_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    answered_at: Mapped[datetime | None]
    due_at: Mapped[datetime]
    faq_document_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("kb_documents.id", ondelete="SET NULL")
    )
    conversation_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("conversations.id", ondelete="SET NULL")
    )

    __table_args__ = (
        Index("ix_escalations_assignee_status", "assignee_id", "status"),
        Index("ix_escalations_user_status", "user_id", "status"),
    )


class Notification(UuidPkMixin, Base):
    __tablename__ = "notifications"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[NotificationKind] = mapped_column(pg_enum(NotificationKind, "notification_kind"))
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text, default="", server_default="")
    link: Mapped[str | None] = mapped_column(String(300))
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    # Proactive nudges set it so the same reminder is never sent twice.
    dedupe_key: Mapped[str | None] = mapped_column(String(200))
    read_at: Mapped[datetime | None]
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())

    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
        Index(
            "uq_notifications_user_dedupe",
            "user_id",
            "dedupe_key",
            unique=True,
            postgresql_where=text("dedupe_key IS NOT NULL"),
        ),
    )
