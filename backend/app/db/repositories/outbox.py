from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import OutboxEvent
from app.domain.events import OutboxStatus, Topic


class OutboxRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, topic: Topic, payload: dict[str, Any]) -> None:
        self._session.add(OutboxEvent(topic=topic.value, payload=payload))

    async def claim_batch(
        self,
        *,
        limit: int,
        now: datetime,
        exclude_topics: tuple[Topic, ...] = (),
        only_topics: tuple[Topic, ...] = (),
    ) -> Sequence[OutboxEvent]:
        # SKIP LOCKED lets several workers run side by side without taking the same event.
        stmt = (
            select(OutboxEvent)
            .where(OutboxEvent.status == OutboxStatus.PENDING, OutboxEvent.available_at <= now)
            .where(OutboxEvent.topic.not_in(exclude_topics))
            .order_by(OutboxEvent.available_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        if only_topics:
            stmt = stmt.where(OutboxEvent.topic.in_(only_topics))
        return (await self._session.scalars(stmt)).all()

    async def backlog(self) -> Sequence[tuple[str, OutboxStatus, int, datetime]]:
        stmt = (
            select(
                OutboxEvent.topic,
                OutboxEvent.status,
                func.count(),
                func.min(OutboxEvent.created_at),
            )
            .where(OutboxEvent.status != OutboxStatus.DONE)
            .group_by(OutboxEvent.topic, OutboxEvent.status)
        )
        return [
            (topic, status, int(count), oldest)
            for topic, status, count, oldest in (await self._session.execute(stmt)).all()
        ]
