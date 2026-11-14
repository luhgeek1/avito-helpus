from collections.abc import Sequence
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Notification
from app.domain.events import NotificationKind


class NotificationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(
        self,
        *,
        user_id: UUID,
        kind: NotificationKind,
        title: str,
        body: str = "",
        link: str | None = None,
        payload: dict[str, Any] | None = None,
        dedupe_key: str | None = None,
        now: datetime,
    ) -> UUID | None:
        """Insert unless the same dedupe key was already used for this user; returns the new id."""
        notification_id = uuid4()
        stmt = (
            insert(Notification)
            .values(
                id=notification_id,
                user_id=user_id,
                kind=kind,
                title=title,
                body=body,
                link=link,
                payload=payload or {},
                dedupe_key=dedupe_key,
                created_at=now,
            )
            .on_conflict_do_nothing(
                index_elements=["user_id", "dedupe_key"],
                index_where=Notification.dedupe_key.is_not(None),
            )
            .returning(Notification.id)
        )
        return await self._session.scalar(stmt)

    async def for_user(
        self, user_id: UUID, *, unread_only: bool, limit: int
    ) -> Sequence[Notification]:
        stmt = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            stmt = stmt.where(Notification.read_at.is_(None))
        stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
        return (await self._session.scalars(stmt)).all()

    async def unread_count(self, user_id: UUID) -> int:
        stmt = select(func.count()).where(
            Notification.user_id == user_id, Notification.read_at.is_(None)
        )
        return int(await self._session.scalar(stmt) or 0)

    async def mark_read(self, user_id: UUID, notification_id: UUID, *, now: datetime) -> bool:
        stmt = (
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(read_at=func.coalesce(Notification.read_at, now))
            .returning(Notification.id)
        )
        return (await self._session.scalar(stmt)) is not None

    async def mark_all_read(self, user_id: UUID, *, now: datetime) -> None:
        await self._session.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
            .values(read_at=now)
        )
