from collections.abc import Sequence
from datetime import date
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import PlanItem, PlanTemplateItem
from app.domain.plan import Audience, ItemStatus


class PlanRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add_template(self, item: PlanTemplateItem) -> None:
        self._session.add(item)

    def add_item(self, item: PlanItem) -> None:
        self._session.add(item)

    async def templates(self, track: str) -> Sequence[PlanTemplateItem]:
        stmt = (
            select(PlanTemplateItem)
            .where(PlanTemplateItem.track.in_(("all", track)))
            .order_by(PlanTemplateItem.stage, PlanTemplateItem.position)
        )
        return (await self._session.scalars(stmt)).all()

    async def template_by_slug(self, slug: str) -> PlanTemplateItem | None:
        return await self._session.scalar(
            select(PlanTemplateItem).where(PlanTemplateItem.slug == slug)
        )

    async def items(self, user_id: UUID) -> Sequence[tuple[PlanItem, PlanTemplateItem]]:
        stmt = (
            select(PlanItem, PlanTemplateItem)
            .join(PlanTemplateItem, PlanItem.template_item_id == PlanTemplateItem.id)
            .where(PlanItem.user_id == user_id)
        )
        return [(item, template) for item, template in (await self._session.execute(stmt)).all()]

    async def items_for_users(
        self, user_ids: Sequence[UUID]
    ) -> Sequence[tuple[PlanItem, PlanTemplateItem]]:
        if not user_ids:
            return []
        stmt = (
            select(PlanItem, PlanTemplateItem)
            .join(PlanTemplateItem, PlanItem.template_item_id == PlanTemplateItem.id)
            .where(PlanItem.user_id.in_(user_ids))
        )
        return [(item, template) for item, template in (await self._session.execute(stmt)).all()]

    async def get(
        self, item_id: UUID, *, for_update: bool = False
    ) -> tuple[PlanItem, PlanTemplateItem] | None:
        stmt = (
            select(PlanItem, PlanTemplateItem)
            .join(PlanTemplateItem, PlanItem.template_item_id == PlanTemplateItem.id)
            .where(PlanItem.id == item_id)
        )
        if for_update:
            stmt = stmt.with_for_update(of=PlanItem).execution_options(populate_existing=True)
        row = (await self._session.execute(stmt)).first()
        return (row[0], row[1]) if row else None

    async def find_by_template_slug(
        self, user_id: UUID, slug: str, *, for_update: bool = False
    ) -> PlanItem | None:
        stmt = (
            select(PlanItem)
            .join(PlanTemplateItem, PlanItem.template_item_id == PlanTemplateItem.id)
            .where(PlanItem.user_id == user_id, PlanTemplateItem.slug == slug)
        )
        if for_update:
            stmt = stmt.with_for_update(of=PlanItem)
        return await self._session.scalar(stmt)

    async def find_by_action(
        self, user_id: UUID, *, kind: str, resource: str | None = None
    ) -> PlanItem | None:
        """The open plan item an action belongs to, e.g. the "request Stash access" step."""
        stmt = (
            select(PlanItem)
            .join(PlanTemplateItem, PlanItem.template_item_id == PlanTemplateItem.id)
            .where(
                PlanItem.user_id == user_id,
                PlanItem.status != ItemStatus.DONE,
                PlanTemplateItem.action["kind"].astext == kind,
            )
            .order_by(PlanItem.due_date)
        )
        if resource is not None:
            stmt = stmt.where(PlanTemplateItem.action["resource"].astext == resource)
        return await self._session.scalar(stmt.limit(1))

    async def overdue(self, today: date) -> Sequence[tuple[PlanItem, PlanTemplateItem]]:
        stmt = (
            select(PlanItem, PlanTemplateItem)
            .join(PlanTemplateItem, PlanItem.template_item_id == PlanTemplateItem.id)
            .where(
                PlanItem.due_date < today,
                PlanItem.status.in_((ItemStatus.TODO, ItemStatus.IN_PROGRESS)),
                PlanTemplateItem.audience == Audience.INTERN,
            )
        )
        return [(item, template) for item, template in (await self._session.execute(stmt)).all()]
