from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Escalation
from app.domain.escalations import EscalationStatus


class EscalationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, escalation: Escalation) -> None:
        self._session.add(escalation)

    async def get(self, escalation_id: UUID, *, for_update: bool = False) -> Escalation | None:
        if not for_update:
            return await self._session.get(Escalation, escalation_id)
        stmt = (
            select(Escalation)
            .where(Escalation.id == escalation_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return await self._session.scalar(stmt)

    async def asked_by(self, user_id: UUID, *, limit: int = 50) -> Sequence[Escalation]:
        stmt = (
            select(Escalation)
            .where(Escalation.user_id == user_id)
            .order_by(Escalation.created_at.desc())
            .limit(limit)
        )
        return (await self._session.scalars(stmt)).all()

    async def assigned_to(
        self, assignee_id: UUID, *, status: EscalationStatus | None, limit: int = 50
    ) -> Sequence[Escalation]:
        stmt = select(Escalation).where(Escalation.assignee_id == assignee_id)
        if status is not None:
            stmt = stmt.where(Escalation.status == status)
        stmt = stmt.order_by(Escalation.due_at).limit(limit)
        return (await self._session.scalars(stmt)).all()

    async def overdue(self, now: datetime) -> Sequence[Escalation]:
        stmt = (
            select(Escalation)
            .where(Escalation.status == EscalationStatus.OPEN, Escalation.due_at < now)
            .with_for_update(skip_locked=True)
        )
        return (await self._session.scalars(stmt)).all()

    async def open_for_users(self, user_ids: Sequence[UUID]) -> Sequence[Escalation]:
        if not user_ids:
            return []
        stmt = select(Escalation).where(
            Escalation.user_id.in_(user_ids), Escalation.status == EscalationStatus.OPEN
        )
        return (await self._session.scalars(stmt)).all()
