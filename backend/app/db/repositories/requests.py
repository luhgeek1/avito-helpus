from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AccessResource, RequestEvent, ServiceRequest
from app.domain.requests import OPEN_STATUSES, RequestKind, RequestSource, RequestStatus


class RequestRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add_resource(self, resource: AccessResource) -> None:
        self._session.add(resource)

    async def resources(self) -> Sequence[AccessResource]:
        stmt = select(AccessResource).order_by(AccessResource.system, AccessResource.name)
        return (await self._session.scalars(stmt)).all()

    async def resource_by_slug(self, slug: str) -> AccessResource | None:
        return await self._session.scalar(select(AccessResource).where(AccessResource.slug == slug))

    def add(self, request: ServiceRequest) -> None:
        self._session.add(request)

    def add_event(
        self,
        request: ServiceRequest,
        *,
        status: RequestStatus,
        source: RequestSource,
        note: str | None = None,
    ) -> None:
        self._session.add(
            RequestEvent(request_id=request.id, status=status, source=source, note=note)
        )

    async def get(self, request_id: UUID, *, for_update: bool = False) -> ServiceRequest | None:
        if not for_update:
            return await self._session.get(ServiceRequest, request_id)
        stmt = (
            select(ServiceRequest)
            .where(ServiceRequest.id == request_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return await self._session.scalar(stmt)

    async def by_idempotency_key(self, key: str) -> ServiceRequest | None:
        return await self._session.scalar(
            select(ServiceRequest).where(ServiceRequest.idempotency_key == key)
        )

    async def by_external_id(self, external_id: str) -> ServiceRequest | None:
        stmt = (
            select(ServiceRequest)
            .where(ServiceRequest.external_id == external_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return await self._session.scalar(stmt)

    async def for_user(
        self,
        user_id: UUID,
        *,
        kind: RequestKind | None = None,
        status: RequestStatus | None = None,
        limit: int = 50,
    ) -> Sequence[ServiceRequest]:
        stmt = select(ServiceRequest).where(ServiceRequest.user_id == user_id)
        if kind is not None:
            stmt = stmt.where(ServiceRequest.kind == kind)
        if status is not None:
            stmt = stmt.where(ServiceRequest.status == status)
        stmt = stmt.order_by(ServiceRequest.created_at.desc()).limit(limit)
        return (await self._session.scalars(stmt)).all()

    async def open_for_resource(self, user_id: UUID, resource_slug: str) -> ServiceRequest | None:
        stmt = select(ServiceRequest).where(
            ServiceRequest.user_id == user_id,
            ServiceRequest.kind == RequestKind.ACCESS,
            ServiceRequest.status.in_(OPEN_STATUSES),
            ServiceRequest.payload["resource"].astext == resource_slug,
        )
        return await self._session.scalar(stmt.limit(1))

    async def events(self, request_ids: Sequence[UUID]) -> Sequence[RequestEvent]:
        if not request_ids:
            return []
        stmt = (
            select(RequestEvent)
            .where(RequestEvent.request_id.in_(request_ids))
            .order_by(RequestEvent.created_at)
        )
        return (await self._session.scalars(stmt)).all()

    async def past_sla(self, now: datetime) -> Sequence[ServiceRequest]:
        stmt = select(ServiceRequest).where(
            ServiceRequest.status == RequestStatus.SUBMITTED,
            ServiceRequest.sla_due_at < now,
        )
        return (await self._session.scalars(stmt)).all()

    async def awaiting_decision(self, *, submitted_before: datetime) -> Sequence[ServiceRequest]:
        """Submitted requests to reconcile with the service in case a webhook got lost."""
        stmt = select(ServiceRequest).where(
            ServiceRequest.status == RequestStatus.SUBMITTED,
            ServiceRequest.updated_at < submitted_before,
            ServiceRequest.external_id.is_not(None),
        )
        return (await self._session.scalars(stmt.limit(50))).all()

    async def open_for_users(self, user_ids: Sequence[UUID]) -> Sequence[ServiceRequest]:
        if not user_ids:
            return []
        stmt = select(ServiceRequest).where(
            ServiceRequest.user_id.in_(user_ids), ServiceRequest.status.in_(OPEN_STATUSES)
        )
        return (await self._session.scalars(stmt)).all()
