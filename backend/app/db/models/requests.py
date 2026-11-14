from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UuidPkMixin, pg_enum, utcnow
from app.domain.requests import (
    AccessLevel,
    ApproverRole,
    RequestKind,
    RequestSource,
    RequestStatus,
    Sensitivity,
)


class AccessResource(UuidPkMixin, TimestampMixin, Base):
    """What can be requested in the access service; visibility follows ABAC rules."""

    __tablename__ = "access_resources"

    slug: Mapped[str] = mapped_column(String(100), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    system: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    team_id: Mapped[UUID | None] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    sensitivity: Mapped[Sensitivity] = mapped_column(
        pg_enum(Sensitivity, "resource_sensitivity"),
        default=Sensitivity.STANDARD,
        server_default=Sensitivity.STANDARD.value,
    )
    approver_role: Mapped[ApproverRole] = mapped_column(
        pg_enum(ApproverRole, "resource_approver_role"),
        default=ApproverRole.TEAM_LEAD,
        server_default=ApproverRole.TEAM_LEAD.value,
    )
    default_level: Mapped[AccessLevel] = mapped_column(
        pg_enum(AccessLevel, "access_level"),
        default=AccessLevel.READ,
        server_default=AccessLevel.READ.value,
    )
    aliases: Mapped[list[str]] = mapped_column(
        ARRAY(String(100)), default=list, server_default="{}"
    )


class ServiceRequest(UuidPkMixin, TimestampMixin, Base):
    """A request sent to a corporate service; the service's answer and history are kept here."""

    __tablename__ = "service_requests"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[RequestKind] = mapped_column(pg_enum(RequestKind, "request_kind"))
    status: Mapped[RequestStatus] = mapped_column(
        pg_enum(RequestStatus, "request_status"),
        default=RequestStatus.SUBMITTING,
        server_default=RequestStatus.SUBMITTING.value,
    )
    title: Mapped[str] = mapped_column(String(300))
    external_id: Mapped[str | None] = mapped_column(String(64), unique=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB)
    approver: Mapped[str | None] = mapped_column(String(200))
    decision_comment: Mapped[str | None] = mapped_column(Text)
    plan_item_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("plan_items.id", ondelete="SET NULL")
    )
    idempotency_key: Mapped[str] = mapped_column(String(256), unique=True)
    sla_due_at: Mapped[datetime | None]
    last_reminded_at: Mapped[datetime | None]
    resolved_at: Mapped[datetime | None]

    __table_args__ = (
        Index("ix_service_requests_user_created", "user_id", "created_at"),
        Index("ix_service_requests_status", "status"),
    )


class RequestEvent(UuidPkMixin, Base):
    __tablename__ = "request_events"

    request_id: Mapped[UUID] = mapped_column(
        ForeignKey("service_requests.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[RequestStatus] = mapped_column(pg_enum(RequestStatus, "request_status"))
    source: Mapped[RequestSource] = mapped_column(pg_enum(RequestSource, "request_source"))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow, server_default=func.now())
