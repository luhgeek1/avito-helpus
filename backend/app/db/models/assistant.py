from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text, func, true
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UuidPkMixin, pg_enum, utcnow
from app.domain.assistant import ActionStatus


class Conversation(UuidPkMixin, TimestampMixin, Base):
    """A chat with Orbi. The model history lives here, server-side, never sent by the client."""

    __tablename__ = "conversations"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200), default="Новый диалог", server_default="")
    model_history: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, default=list, server_default="[]"
    )

    __table_args__ = (Index("ix_conversations_user_updated", "user_id", "updated_at"),)


class ChatMessage(UuidPkMixin, Base):
    """What the UI renders: text plus source, card and request parts."""

    __tablename__ = "chat_messages"

    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))
    parts: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    feedback: Mapped[str | None] = mapped_column(String(8))
    feedback_comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())


class PendingAction(UuidPkMixin, TimestampMixin, Base):
    """A confirmation card: the deferred tool call the user has to approve or reject."""

    __tablename__ = "pending_actions"

    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    tool_call_id: Mapped[str] = mapped_column(String(128), unique=True)
    tool_name: Mapped[str] = mapped_column(String(64))
    args: Mapped[dict[str, Any]] = mapped_column(JSONB)
    card: Mapped[dict[str, Any]] = mapped_column(JSONB)
    status: Mapped[ActionStatus] = mapped_column(
        pg_enum(ActionStatus, "pending_action_status"),
        default=ActionStatus.PENDING,
        server_default=ActionStatus.PENDING.value,
    )
    expires_at: Mapped[datetime]
    decided_at: Mapped[datetime | None]


class AnalyticsEventRow(UuidPkMixin, Base):
    __tablename__ = "analytics_events"

    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(64))
    properties: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    variant: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())

    __table_args__ = (Index("ix_analytics_events_name_created", "name", "created_at"),)


class AuditLog(UuidPkMixin, Base):
    __tablename__ = "audit_log"

    actor_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(64))
    target_type: Mapped[str] = mapped_column(String(32))
    target_id: Mapped[str | None] = mapped_column(String(64))
    details: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())

    __table_args__ = (Index("ix_audit_log_created", "created_at"),)


class FeatureFlagRow(TimestampMixin, Base):
    __tablename__ = "feature_flags"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    rollout_percent: Mapped[int] = mapped_column(Integer, default=100, server_default="100")
    variants: Mapped[list[str]] = mapped_column(
        ARRAY(String(32)), default=list, server_default="{}"
    )
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
