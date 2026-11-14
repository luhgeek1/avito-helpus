import asyncio
import json
import time
from collections.abc import AsyncIterator
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, status
from fastapi.responses import StreamingResponse

from app.api.deps import (
    CurrentUserDep,
    EscalationServiceDep,
    KnowledgeServiceDep,
    MentorServiceDep,
    PlanServiceDep,
    RedisDep,
    RequestServiceDep,
    SettingsDep,
    UowDep,
    require,
)
from app.api.schemas.misc import (
    AnswerIn,
    CorpWebhookIn,
    EscalationIn,
    EscalationOut,
    MenteeDetailOut,
    MenteeOut,
    NotificationOut,
    NotificationsOut,
)
from app.api.schemas.plan import PlanItemOut, ReviewIn
from app.core.clock import today, utcnow
from app.core.errors import ErrorCode, NotFoundError, UnauthorizedError
from app.core.security import webhooks
from app.domain.corp import CorpTicketStatus
from app.domain.escalations import EscalationStatus
from app.domain.requests import RequestSource
from app.domain.users import CurrentUser, Permission
from app.infra.bus import subscribe

escalations_router = APIRouter(prefix="/escalations", tags=["Escalations"])
mentees_router = APIRouter(prefix="/mentees", tags=["Mentor"])
notifications_router = APIRouter(tags=["Notifications"])
integrations_router = APIRouter(prefix="/integrations", tags=["Integrations"])

Asker = Annotated[CurrentUser, Depends(require(Permission.ESCALATIONS_CREATE))]
Mentor = Annotated[CurrentUser, Depends(require(Permission.MENTEES_READ))]
Responder = Annotated[CurrentUser, Depends(require(Permission.ESCALATIONS_ANSWER))]

KEEPALIVE_SEC = 15.0


# ---- escalations -------------------------------------------------------------------------------


@escalations_router.get(
    path="", summary="Questions I asked, or (scope=assigned) questions I answer"
)
async def list_escalations(
    user: CurrentUserDep,
    svc: EscalationServiceDep,
    scope: Annotated[Literal["mine", "assigned"], Query()] = "mine",
    status_: Annotated[EscalationStatus | None, Query(alias="status")] = None,
) -> list[EscalationOut]:
    if scope == "assigned":
        await require(Permission.ESCALATIONS_ANSWER)(user)
        views = await svc.assigned(user, status=status_)
    else:
        views = await svc.mine(user)
    return [EscalationOut.from_domain(v) for v in views]


@escalations_router.post(
    path="", status_code=status.HTTP_201_CREATED, summary="Ask my mentor directly"
)
async def create_escalation(
    payload: EscalationIn, user: Asker, svc: EscalationServiceDep
) -> EscalationOut:
    view = await svc.create(
        user, question=payload.question, kind=payload.kind, context={"source": "web"}
    )
    return EscalationOut.from_domain(view)


@escalations_router.get(path="/{escalation_id}", summary="One question with its answer")
async def get_escalation(
    escalation_id: UUID, user: CurrentUserDep, svc: EscalationServiceDep
) -> EscalationOut:
    return EscalationOut.from_domain(await svc.get(user, escalation_id))


@escalations_router.post(
    path="/{escalation_id}/answer", summary="Answer; optionally publish to the team FAQ"
)
async def answer(
    escalation_id: UUID,
    payload: AnswerIn,
    user: Responder,
    svc: EscalationServiceDep,
    knowledge: KnowledgeServiceDep,
) -> EscalationOut:
    view = await svc.answer(
        user,
        escalation_id,
        answer=payload.answer,
        publish_to_faq=payload.publish_to_faq,
        knowledge=knowledge,
    )
    return EscalationOut.from_domain(view)


@escalations_router.post(
    path="/{escalation_id}/close", summary="Close my question (resolved myself)"
)
async def close(
    escalation_id: UUID, user: CurrentUserDep, svc: EscalationServiceDep
) -> EscalationOut:
    return EscalationOut.from_domain(await svc.close(user, escalation_id))


# ---- mentor ------------------------------------------------------------------------------------


@mentees_router.get(
    path="", summary="My mentees (mentor), team interns (lead) or my interns (HRBP)"
)
async def mentees(user: Mentor, svc: MentorServiceDep) -> list[MenteeOut]:
    on = today()
    return [MenteeOut.from_domain(s, on) for s in await svc.mentees(user)]


@mentees_router.get(path="/{mentee_id}", summary="Plan, requests and questions of one mentee")
async def mentee(mentee_id: UUID, user: Mentor, svc: MentorServiceDep) -> MenteeDetailOut:
    return MenteeDetailOut.from_domain(await svc.mentee(user, mentee_id), today())


@mentees_router.post(
    path="/{mentee_id}/plan/items/{item_id}/review",
    summary="Confirm (approve) or return a step, or complete a mentor task for the mentee",
)
async def review(
    mentee_id: UUID,
    item_id: UUID,
    payload: ReviewIn,
    user: Annotated[CurrentUser, Depends(require(Permission.PLAN_REVIEW))],
    svc: MentorServiceDep,
    plan: PlanServiceDep,
) -> PlanItemOut:
    await svc.mentee(user, mentee_id)
    view = await plan.transition(user, item_id, payload.transition, comment=payload.comment)
    if view.user_id != mentee_id:
        raise NotFoundError("Plan item not found")
    return PlanItemOut.from_domain(view, today())


# ---- notifications -----------------------------------------------------------------------------


@notifications_router.get(path="/notifications", summary="My notifications, newest first")
async def notifications(
    user: CurrentUserDep,
    uow: UowDep,
    unread_only: bool = False,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> NotificationsOut:
    rows = await uow.notifications.for_user(user.id, unread_only=unread_only, limit=limit)
    return NotificationsOut(
        unread=await uow.notifications.unread_count(user.id),
        items=[NotificationOut.model_validate(r) for r in rows],
    )


@notifications_router.post(
    path="/notifications/{notification_id}/read",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Mark one notification read",
)
async def read_one(notification_id: UUID, user: CurrentUserDep, uow: UowDep) -> None:
    if not await uow.notifications.mark_read(user.id, notification_id, now=utcnow()):
        raise NotFoundError("Notification not found")


@notifications_router.post(
    path="/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT, summary="Mark all read"
)
async def read_all(user: CurrentUserDep, uow: UowDep) -> None:
    await uow.notifications.mark_all_read(user.id, now=utcnow())


@notifications_router.get(
    path="/events",
    summary="Realtime SSE: notification.created, request.updated, plan.updated, escalation.updated",
    response_class=StreamingResponse,
)
async def events(request: Request, user: CurrentUserDep, redis: RedisDep) -> StreamingResponse:
    async def generate() -> AsyncIterator[str]:
        yield "retry: 3000\n\n"
        queue: asyncio.Queue[dict[str, object]] = asyncio.Queue()

        async def pump() -> None:
            async for message in subscribe(redis, str(user.id)):
                await queue.put(message)

        task = asyncio.create_task(pump())
        try:
            while not await request.is_disconnected():
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=KEEPALIVE_SEC)
                except TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                payload = json.dumps(message["data"], ensure_ascii=False, default=str)
                yield f"event: {message['event']}\ndata: {payload}\n\n"
        finally:
            task.cancel()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---- integrations ------------------------------------------------------------------------------


class WebhookSignatureError(UnauthorizedError):
    error_code = ErrorCode.WEBHOOK_SIGNATURE_INVALID
    default_detail = "Webhook signature is missing, stale or invalid"


@integrations_router.post(
    path="/corp/webhook",
    summary="Decision from a corporate service (HMAC-signed, replay-protected, idempotent)",
    responses={401: {"description": "Bad signature"}},
)
async def corp_webhook(
    request: Request,
    svc: RequestServiceDep,
    settings: SettingsDep,
    timestamp: Annotated[str | None, Header(alias="X-Corp-Timestamp")] = None,
    signature: Annotated[str | None, Header(alias="X-Corp-Signature")] = None,
) -> dict[str, str]:
    body = await request.body()
    if not webhooks.verify(
        settings.corp_webhook_secret.get_secret_value(),
        timestamp=timestamp,
        signature=signature,
        body=body,
        now=time.time(),
        tolerance_sec=settings.corp_webhook_tolerance_sec,
    ):
        raise WebhookSignatureError()
    payload = CorpWebhookIn.model_validate_json(body)
    view = await svc.apply_decision(
        external_id=payload.request_id,
        status=CorpTicketStatus(payload.status),
        comment=payload.comment,
        source=RequestSource.WEBHOOK,
    )
    return {"status": "accepted" if view else "ignored"}
