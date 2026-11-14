from datetime import date
from typing import Any, Self
from uuid import UUID

from pydantic import Field

from app.api.schemas.base import MoscowDateTime, RequestModel, ResponseModel
from app.domain.absence import AbsenceCheck, AbsenceType
from app.domain.corp import EquipmentStatus
from app.domain.requests import (
    AccessLevel,
    AccessResource,
    RequestKind,
    RequestSource,
    RequestStatus,
    RequestView,
)
from app.service.requests import AccessPreparation, EquipmentOverview


class RequestEventOut(ResponseModel):
    status: RequestStatus
    source: RequestSource
    note: str | None
    created_at: MoscowDateTime


class RequestOut(ResponseModel):
    id: UUID
    kind: RequestKind
    status: RequestStatus
    status_title: str
    title: str
    external_id: str | None
    payload: dict[str, Any]
    approver: str | None
    decision_comment: str | None
    plan_item_id: UUID | None
    sla_due_at: MoscowDateTime | None
    created_at: MoscowDateTime
    updated_at: MoscowDateTime
    history: list[RequestEventOut]

    @classmethod
    def from_domain(cls, view: RequestView) -> Self:
        data = {f: getattr(view, f) for f in view.__dataclass_fields__}
        data["payload"] = dict(view.payload)
        data["status_title"] = view.status_title
        return cls.model_validate(data)


class ResourceOut(ResponseModel):
    slug: str
    name: str
    system: str
    description: str
    default_level: AccessLevel


class AccessIn(RequestModel):
    resource: str = Field(..., min_length=2, max_length=200, description="Slug or free text")
    level: AccessLevel | None = None
    justification: str | None = Field(None, max_length=1000)


class AccessCreateIn(AccessIn):
    idempotency_key: str = Field(..., min_length=8, max_length=128)


class AccessPreviewOut(ResponseModel):
    outcome: str
    resource: ResourceOut | None
    level: AccessLevel | None
    justification: str | None
    approver: str | None
    sla_hours: float | None
    allowed_levels: list[AccessLevel]
    existing: RequestOut | None
    candidates: list[ResourceOut]
    card: dict[str, Any] | None

    @classmethod
    def from_domain(cls, prep: AccessPreparation) -> Self:
        ready = (
            prep.resource is not None and prep.level is not None and prep.outcome.value == "ready"
        )
        return cls(
            outcome=prep.outcome.value,
            resource=ResourceOut.model_validate(prep.resource) if prep.resource else None,
            level=prep.level,
            justification=prep.justification,
            approver=prep.approver,
            sla_hours=prep.sla_hours,
            allowed_levels=list(prep.allowed_levels),
            existing=RequestOut.from_domain(prep.existing) if prep.existing else None,
            candidates=[ResourceOut.model_validate(c) for c in prep.candidates],
            card=prep.card().as_dict() if ready else None,
        )


class AccessCreateOut(ResponseModel):
    outcome: str
    request: RequestOut | None


def resources_out(resources: list[AccessResource]) -> list[ResourceOut]:
    return [ResourceOut.model_validate(r) for r in resources]


class AbsenceIn(RequestModel):
    type: AbsenceType
    start_date: date
    end_date: date


class AbsenceCreateIn(AbsenceIn):
    comment: str = Field("", max_length=500)
    idempotency_key: str = Field(..., min_length=8, max_length=128)


class CalendarConflictOut(ResponseModel):
    title: str
    starts_at: MoscowDateTime


class AbsenceCheckOut(ResponseModel):
    type: AbsenceType
    title: str
    start: date
    end: date
    working_days: int
    balance: int
    balance_after: int
    warnings: list[str]
    conflicts: list[CalendarConflictOut]

    @classmethod
    def from_domain(cls, check: AbsenceCheck) -> Self:
        data = {f: getattr(check, f) for f in check.__dataclass_fields__}
        data["title"] = check.title
        return cls.model_validate(data)


class EquipmentItemOut(ResponseModel):
    kind: str
    model: str
    status: EquipmentStatus
    status_title: str
    eta: date | None
    pickup_location: str | None
    pickup_hours: str | None
    note: str | None


class MeanwhileOut(ResponseModel):
    id: UUID
    title: str
    due_date: date


class EquipmentOut(ResponseModel):
    items: list[EquipmentItemOut]
    meanwhile: list[MeanwhileOut]
    ticket: RequestOut | None

    @classmethod
    def from_domain(cls, overview: EquipmentOverview) -> Self:
        return cls(
            items=[EquipmentItemOut.model_validate(i) for i in overview.items],
            meanwhile=[MeanwhileOut.model_validate(m) for m in overview.meanwhile],
            ticket=RequestOut.from_domain(overview.ticket) if overview.ticket else None,
        )


class ItTicketIn(RequestModel):
    category: str = Field(..., min_length=2, max_length=100)
    description: str = Field(..., min_length=5, max_length=2000)
    idempotency_key: str = Field(..., min_length=8, max_length=128)
