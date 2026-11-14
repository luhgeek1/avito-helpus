from collections.abc import Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Float, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AnalyticsEventRow,
    AuditLog,
    Escalation,
    FeatureFlagRow,
    PlanItem,
    ServiceRequest,
)
from app.domain.escalations import EscalationStatus
from app.domain.plan import ItemStatus
from app.domain.requests import RequestKind, RequestStatus


class OpsRepository:
    """Analytics, audit and feature flags: write-mostly tables for operating the product."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def track(
        self,
        name: str,
        *,
        user_id: UUID | None,
        properties: dict[str, Any] | None = None,
        variant: str | None = None,
    ) -> None:
        self._session.add(
            AnalyticsEventRow(
                user_id=user_id, name=name, properties=properties or {}, variant=variant
            )
        )

    def audit(
        self,
        action: str,
        *,
        actor_id: UUID | None,
        target_type: str,
        target_id: str | None,
        details: dict[str, Any] | None = None,
    ) -> None:
        self._session.add(
            AuditLog(
                actor_id=actor_id,
                action=action,
                target_type=target_type,
                target_id=target_id,
                details=details or {},
            )
        )

    async def audit_entries(self, *, limit: int) -> Sequence[AuditLog]:
        stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
        return (await self._session.scalars(stmt)).all()

    async def flags(self) -> Sequence[FeatureFlagRow]:
        return (
            await self._session.scalars(select(FeatureFlagRow).order_by(FeatureFlagRow.key))
        ).all()

    async def flag(self, key: str, *, for_update: bool = False) -> FeatureFlagRow | None:
        stmt = select(FeatureFlagRow).where(FeatureFlagRow.key == key)
        if for_update:
            stmt = stmt.with_for_update()
        return await self._session.scalar(stmt)

    def add_flag(self, flag: FeatureFlagRow) -> None:
        self._session.add(flag)

    async def count_events(self, name: str, *, since: datetime) -> dict[str | None, int]:
        stmt = (
            select(AnalyticsEventRow.variant, func.count())
            .where(AnalyticsEventRow.name == name, AnalyticsEventRow.created_at >= since)
            .group_by(AnalyticsEventRow.variant)
        )
        return {variant: int(count) for variant, count in (await self._session.execute(stmt)).all()}

    async def feedback_counts(self, *, since: datetime) -> dict[str, int]:
        rating = AnalyticsEventRow.properties["rating"].astext
        stmt = (
            select(rating, func.count())
            .where(
                AnalyticsEventRow.name == "answer.feedback", AnalyticsEventRow.created_at >= since
            )
            .group_by(rating)
        )
        return {str(r): int(c) for r, c in (await self._session.execute(stmt)).all()}

    async def access_hours(self, *, since: datetime) -> tuple[float | None, int]:
        """Average hours from an access request to its approval, and how many were approved."""
        hours = (
            cast(
                func.extract("epoch", ServiceRequest.resolved_at - ServiceRequest.created_at), Float
            )
            / 3600
        )
        stmt = select(func.avg(hours), func.count()).where(
            ServiceRequest.kind == RequestKind.ACCESS,
            ServiceRequest.status == RequestStatus.APPROVED,
            ServiceRequest.created_at >= since,
        )
        avg, count = (await self._session.execute(stmt)).one()
        return (float(avg) if avg is not None else None), int(count)

    async def plan_on_time(self) -> tuple[int, int]:
        """Items done by their deadline vs all items whose deadline has passed or are done."""
        on_time = func.count().filter(
            PlanItem.status == ItemStatus.DONE,
            func.date(PlanItem.completed_at) <= PlanItem.due_date,
        )
        due = func.count().filter(
            (PlanItem.status == ItemStatus.DONE) | (PlanItem.due_date < func.current_date())
        )
        done_on_time, total_due = (await self._session.execute(select(on_time, due))).one()
        return int(done_on_time), int(total_due)

    async def escalation_stats(self, *, since: datetime) -> tuple[int, int, float | None]:
        hours = (
            cast(func.extract("epoch", Escalation.answered_at - Escalation.created_at), Float)
            / 3600
        )
        stmt = select(
            func.count(),
            func.count().filter(Escalation.status != EscalationStatus.OPEN),
            func.avg(hours),
        ).where(Escalation.created_at >= since)
        total, resolved, avg = (await self._session.execute(stmt)).one()
        return int(total), int(resolved), (float(avg) if avg is not None else None)
