from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import RequestServiceDep, require
from app.api.schemas.requests import (
    AbsenceCheckOut,
    AbsenceCreateIn,
    AbsenceIn,
    AccessCreateIn,
    AccessCreateOut,
    AccessIn,
    AccessPreviewOut,
    EquipmentOut,
    ItTicketIn,
    RequestOut,
    ResourceOut,
    resources_out,
)
from app.domain.requests import RequestKind, RequestSource, RequestStatus
from app.domain.users import CurrentUser, Permission

router = APIRouter(tags=["Requests"])

Requester = Annotated[CurrentUser, Depends(require(Permission.REQUESTS_OWN))]


@router.get(path="/requests", summary="My requests to corporate services")
async def list_requests(
    user: Requester,
    svc: RequestServiceDep,
    kind: Annotated[RequestKind | None, Query()] = None,
    status_: Annotated[RequestStatus | None, Query(alias="status")] = None,
) -> list[RequestOut]:
    return [RequestOut.from_domain(v) for v in await svc.requests(user, kind=kind, status=status_)]


@router.get(path="/requests/{request_id}", summary="One request with its status history")
async def get_request(request_id: UUID, user: Requester, svc: RequestServiceDep) -> RequestOut:
    return RequestOut.from_domain(await svc.get(user, request_id))


@router.post(path="/requests/{request_id}/cancel", summary="Withdraw my request")
async def cancel_request(request_id: UUID, user: Requester, svc: RequestServiceDep) -> RequestOut:
    return RequestOut.from_domain(await svc.cancel(user, request_id))


@router.post(
    path="/requests/{request_id}/remind",
    summary="Remind the access approver (once a day)",
    responses={409: {"description": "Too soon or the request isn't waiting for approval"}},
)
async def remind(request_id: UUID, user: Requester, svc: RequestServiceDep) -> RequestOut:
    return RequestOut.from_domain(await svc.remind(user, request_id))


@router.get(path="/access/resources", summary="Access catalog visible to my role and team")
async def resources(user: Requester, svc: RequestServiceDep) -> list[ResourceOut]:
    return resources_out(await svc.catalog(user))


@router.post(
    path="/requests/access/preview",
    summary="What an access request would look like (no side effects): the confirmation card",
)
async def preview_access(
    payload: AccessIn, user: Requester, svc: RequestServiceDep
) -> AccessPreviewOut:
    prep = await svc.prepare_access(
        user, resource=payload.resource, level=payload.level, justification=payload.justification
    )
    return AccessPreviewOut.from_domain(prep)


@router.post(
    path="/requests/access",
    status_code=status.HTTP_201_CREATED,
    summary="Create an access request after the user confirmed the card (idempotent by key)",
)
async def create_access(
    payload: AccessCreateIn, user: Requester, svc: RequestServiceDep
) -> AccessCreateOut:
    prep, view = await svc.create_access(
        user,
        resource=payload.resource,
        level=payload.level,
        justification=payload.justification,
        idempotency_key=f"web:{user.id}:{payload.idempotency_key}",
        source=RequestSource.USER,
    )
    return AccessCreateOut(
        outcome=prep.outcome.value, request=RequestOut.from_domain(view) if view else None
    )


@router.post(path="/requests/absence/check", summary="Days left, rules and meeting conflicts")
async def check_absence(
    payload: AbsenceIn, user: Requester, svc: RequestServiceDep
) -> AbsenceCheckOut:
    check = await svc.check_absence(
        user, type_=payload.type, start=payload.start_date, end=payload.end_date
    )
    return AbsenceCheckOut.from_domain(check)


@router.post(
    path="/requests/absence",
    status_code=status.HTTP_201_CREATED,
    summary="File a day off or vacation request (idempotent by key)",
)
async def create_absence(
    payload: AbsenceCreateIn, user: Requester, svc: RequestServiceDep
) -> RequestOut:
    view = await svc.create_absence(
        user,
        type_=payload.type,
        start=payload.start_date,
        end=payload.end_date,
        comment=payload.comment,
        idempotency_key=f"web:{user.id}:{payload.idempotency_key}",
        source=RequestSource.USER,
    )
    return RequestOut.from_domain(view)


@router.get(
    path="/equipment", summary="My laptop and equipment: status, pickup, what to do meanwhile"
)
async def equipment(user: Requester, svc: RequestServiceDep) -> EquipmentOut:
    return EquipmentOut.from_domain(await svc.equipment(user))


@router.post(
    path="/requests/it-ticket",
    status_code=status.HTTP_201_CREATED,
    summary="Open an IT support ticket (idempotent by key)",
)
async def create_it_ticket(
    payload: ItTicketIn, user: Requester, svc: RequestServiceDep
) -> RequestOut:
    view = await svc.create_it_ticket(
        user,
        category=payload.category,
        description=payload.description,
        idempotency_key=f"web:{user.id}:{payload.idempotency_key}",
        source=RequestSource.USER,
    )
    return RequestOut.from_domain(view)
