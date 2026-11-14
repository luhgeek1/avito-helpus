import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from enum import StrEnum
from typing import Any
from uuid import UUID

from app.core.clock import LOCAL_TZ, today, utcnow
from app.core.config import Settings
from app.core.errors import ConflictError
from app.db.database import Database
from app.db.models import ServiceRequest, User
from app.db.uow import UnitOfWork
from app.domain.absence import (
    ABSENCE_TITLES,
    AbsenceCheck,
    AbsenceDatesError,
    AbsenceType,
    CalendarEvent,
    evaluate_absence,
)
from app.domain.assistant import ActionCard, CardField
from app.domain.corp import (
    AccessGrant,
    CorpRequestError,
    CorpTicket,
    CorpTicketStatus,
    CorpUnavailableError,
    EquipmentItem,
    EquipmentStatus,
)
from app.domain.events import AnalyticsEvent, AuditAction, NotificationKind, RealtimeEvent, Topic
from app.domain.plan import STAGE_TITLES, ActionKind, ItemStatus, PlanItemView, current_stage
from app.domain.requests import (
    LEVEL_TITLES,
    OPEN_STATUSES,
    STATUS_TITLES,
    AccessLevel,
    AccessResource,
    ApproverRole,
    RemindTooSoonError,
    RequestKind,
    RequestNotFoundError,
    RequestSource,
    RequestStatus,
    RequestTransitionError,
    RequestView,
    access_justification,
    allowed_levels,
    ensure_level_allowed,
    ensure_transition,
    match_resources,
    resource_visible,
)
from app.domain.users import CurrentUser, UserNotFoundError
from app.service.mappers import to_plan_item, to_request, to_resource
from app.service.notify import notify, push
from app.service.people import PeopleService
from app.service.plan import PlanService
from app.service.ports import CorpServices

logger = logging.getLogger(__name__)

ACCESS_SERVICE = "Сервис доступов"
ABSENCE_SERVICE = "Сервис отсутствий"
IT_SERVICE = "IT-поддержка"
REMIND_COOLDOWN = timedelta(hours=20)
MAX_ABSENCE_SPAN_DAYS = 366
_SLA_HOURS = {RequestKind.ACCESS: 24.0, RequestKind.ABSENCE: 24.0, RequestKind.EQUIPMENT: 8.0}
_CORP_TO_STATUS = {
    CorpTicketStatus.APPROVED: RequestStatus.APPROVED,
    CorpTicketStatus.REJECTED: RequestStatus.REJECTED,
    CorpTicketStatus.CANCELLED: RequestStatus.CANCELLED,
}


class AccessOutcome(StrEnum):
    READY = "ready"
    ALREADY_GRANTED = "already_granted"
    PENDING_EXISTS = "pending_exists"
    NOT_FOUND = "not_found"
    AMBIGUOUS = "ambiguous"


@dataclass(frozen=True, slots=True)
class AccessPreparation:
    outcome: AccessOutcome
    resource: AccessResource | None = None
    level: AccessLevel | None = None
    justification: str | None = None
    approver: str | None = None
    plan_item_id: UUID | None = None
    sla_hours: float | None = None
    grant: AccessGrant | None = None
    existing: RequestView | None = None
    candidates: list[AccessResource] = field(default_factory=list)
    allowed_levels: tuple[AccessLevel, ...] = ()
    service_down: bool = False

    def card(self) -> ActionCard:
        assert self.resource is not None  # noqa: S101 - only READY preparations have cards
        assert self.level is not None  # noqa: S101
        return ActionCard(
            kind="access_request",
            title=f"Заявка на доступ: {self.resource.name}",
            service=ACCESS_SERVICE,
            fields=[
                CardField("resource", "Ресурс", f"{self.resource.name} ({self.resource.system})"),
                CardField("level", "Уровень", LEVEL_TITLES[self.level], editable=True),
                CardField("approver", "Согласует", self.approver or "—"),
                CardField("justification", "Обоснование", self.justification or "", editable=True),
                CardField("sla", "Срок согласования", f"до {self.sla_hours:g} ч"),
            ],
            warnings=(
                ["Сервис доступов сейчас не отвечает: заявку сохраню и отправлю автоматически."]
                if self.service_down
                else []
            ),
            note=(
                "После подтверждения заявка уйдёт в сервис доступов, "
                "статус появится в «Моих заявках»."
            ),
        )


@dataclass(frozen=True, slots=True)
class EquipmentOverview:
    items: list[EquipmentItem]
    meanwhile: list[PlanItemView]
    ticket: RequestView | None


class RequestService:
    """Requests to corporate services: preparation, creation, decisions and their consequences."""

    def __init__(self, uow: UnitOfWork, corp: CorpServices, *, access_sla_hours: float) -> None:
        self._uow = uow
        self._corp = corp
        self._access_sla = access_sla_hours

    # ---- reading ---------------------------------------------------------------------------

    async def requests(
        self,
        actor: CurrentUser,
        *,
        kind: RequestKind | None = None,
        status: RequestStatus | None = None,
        user_id: UUID | None = None,
    ) -> list[RequestView]:
        if user_id is not None and user_id != actor.id:
            await PeopleService(self._uow).member(actor, user_id)
        rows = await self._uow.requests.for_user(user_id or actor.id, kind=kind, status=status)
        events = await self._uow.requests.events([r.id for r in rows])
        return [to_request(row, events) for row in rows]

    async def get(self, actor: CurrentUser, request_id: UUID) -> RequestView:
        row = await self._uow.requests.get(request_id)
        if row is None or row.user_id != actor.id:
            raise RequestNotFoundError()
        return to_request(row, await self._uow.requests.events([row.id]))

    async def catalog(self, actor: CurrentUser) -> list[AccessResource]:
        resources = [to_resource(r) for r in await self._uow.requests.resources()]
        return [r for r in resources if resource_visible(r, role=actor.role, team_id=actor.team_id)]

    # ---- access ------------------------------------------------------------------------------

    async def prepare_access(
        self,
        actor: CurrentUser,
        *,
        resource: str,
        level: AccessLevel | None = None,
        justification: str | None = None,
    ) -> AccessPreparation:
        """What must hold before a card is shown: visibility, level, duplicates, grants."""
        user = await self._user(actor.id)
        visible = await self.catalog(actor)
        exact = next((r for r in visible if r.slug == resource), None)
        matches = [exact] if exact else match_resources(resource, visible)
        if not matches:
            return AccessPreparation(outcome=AccessOutcome.NOT_FOUND)
        if len(matches) > 1 and not exact:
            return AccessPreparation(outcome=AccessOutcome.AMBIGUOUS, candidates=matches[:4])
        target = matches[0]

        chosen = level or target.default_level
        ensure_level_allowed(actor.role, chosen)

        existing = await self._uow.requests.open_for_resource(actor.id, target.slug)
        if existing is not None:
            view = to_request(existing, await self._uow.requests.events([existing.id]))
            return AccessPreparation(
                outcome=AccessOutcome.PENDING_EXISTS, resource=target, existing=view
            )

        try:
            grant = await self._corp.access_check(employee=user.email, resource=target.slug)
        except CorpUnavailableError:
            # Degrade, don't fail: the request is kept and sent when the service is back.
            logger.warning("access check unavailable for %s", target.slug)
            grant = AccessGrant(has_access=False)
            service_down = True
        else:
            service_down = False
        if grant.has_access:
            return AccessPreparation(
                outcome=AccessOutcome.ALREADY_GRANTED, resource=target, grant=grant
            )

        team = await self._uow.people.team(user.team_id)
        stage = STAGE_TITLES[current_stage(user.start_date or today(), today())].lower()
        plan_item = await self._uow.plan.find_by_action(
            actor.id, kind=ActionKind.ACCESS_REQUEST, resource=target.slug
        )
        return AccessPreparation(
            outcome=AccessOutcome.READY,
            resource=target,
            level=chosen,
            justification=(justification or "").strip()
            or access_justification(target, team_name=team.name if team else None, stage=stage),
            approver=await self._approver(target, user),
            plan_item_id=plan_item.id if plan_item else None,
            sla_hours=self._access_sla,
            allowed_levels=allowed_levels(actor.role),
            service_down=service_down,
        )

    async def create_access(
        self,
        actor: CurrentUser,
        *,
        resource: str,
        level: AccessLevel | None,
        justification: str | None,
        idempotency_key: str,
        source: RequestSource,
    ) -> tuple[AccessPreparation, RequestView | None]:
        """Re-checks everything (the card may be stale) and records the request for submission."""
        if (
            existing := await self._existing(actor, idempotency_key, RequestKind.ACCESS)
        ) is not None:
            prep = AccessPreparation(outcome=AccessOutcome.READY)
            return prep, to_request(existing, await self._uow.requests.events([existing.id]))
        prep = await self.prepare_access(
            actor, resource=resource, level=level, justification=justification
        )
        if prep.outcome is not AccessOutcome.READY or prep.resource is None or prep.level is None:
            return prep, None
        request = await self._create(
            actor,
            kind=RequestKind.ACCESS,
            title=f"Доступ: {prep.resource.name} ({LEVEL_TITLES[prep.level]})",
            payload={
                "resource": prep.resource.slug,
                "resource_name": prep.resource.name,
                "system": prep.resource.system,
                "level": prep.level.value,
                "justification": prep.justification,
            },
            approver=prep.approver,
            plan_item_id=prep.plan_item_id,
            idempotency_key=idempotency_key,
            source=source,
        )
        return prep, request

    # ---- absence -----------------------------------------------------------------------------

    async def check_absence(
        self, actor: CurrentUser, *, type_: AbsenceType, start: date, end: date
    ) -> AbsenceCheck:
        if start < today() or end < start or (end - start).days > MAX_ABSENCE_SPAN_DAYS:
            raise AbsenceDatesError()
        user = await self._user(actor.id)
        balance = await self._corp.absence_balance(employee=user.email)
        events = await self._corp.calendar_events(employee=user.email, start=start, end=end)
        return evaluate_absence(
            type_=type_,
            start=start,
            end=end,
            today=today(),
            internship_start=user.start_date,
            balance=balance,
            events=[CalendarEvent(e.title, _local_time(e.starts_at), e.important) for e in events],
        )

    async def absence_card(
        self, actor: CurrentUser, check: AbsenceCheck, comment: str
    ) -> ActionCard:
        user = await self._user(actor.id)
        lead = await self._uow.people.get(user.lead_id) if user.lead_id else None
        return ActionCard(
            kind="absence_request",
            title=f"Заявка: {check.title}",
            service=ABSENCE_SERVICE,
            fields=[
                CardField("type", "Тип", ABSENCE_TITLES[check.type]),
                CardField("dates", "Даты", _dates(check.start, check.end)),
                CardField("days", "Рабочих дней", str(check.working_days)),
                CardField("balance", "Останется дней", f"{check.balance_after} из {check.balance}"),
                CardField("approver", "Согласует", lead.full_name if lead else "Руководитель"),
                CardField("comment", "Комментарий", comment, editable=True),
            ],
            warnings=list(check.warnings),
            note="После подтверждения заявка уйдёт в сервис отсутствий.",
        )

    async def create_absence(
        self,
        actor: CurrentUser,
        *,
        type_: AbsenceType,
        start: date,
        end: date,
        comment: str,
        idempotency_key: str,
        source: RequestSource,
    ) -> RequestView:
        if (
            existing := await self._existing(actor, idempotency_key, RequestKind.ABSENCE)
        ) is not None:
            return to_request(existing)
        check = await self.check_absence(actor, type_=type_, start=start, end=end)
        user = await self._user(actor.id)
        lead = await self._uow.people.get(user.lead_id) if user.lead_id else None
        plan_item = await self._uow.plan.find_by_action(actor.id, kind=ActionKind.ABSENCE_REQUEST)
        return await self._create(
            actor,
            kind=RequestKind.ABSENCE,
            title=check.title,
            payload={
                "type": type_.value,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "working_days": check.working_days,
                "comment": comment,
                "warnings": check.warnings,
            },
            approver=lead.full_name if lead else "Руководитель",
            plan_item_id=plan_item.id if plan_item else None,
            idempotency_key=idempotency_key,
            source=source,
        )

    # ---- equipment ---------------------------------------------------------------------------

    async def equipment(self, actor: CurrentUser) -> EquipmentOverview:
        user = await self._user(actor.id)
        items = await self._corp.equipment(employee=user.email)
        rows = await self._uow.plan.items(actor.id)
        meanwhile = sorted(
            (
                to_plan_item(item, template)
                for item, template in rows
                if not template.needs_laptop
                and item.status in {ItemStatus.TODO, ItemStatus.IN_PROGRESS}
                and template.audience.value == "intern"
            ),
            key=lambda view: (view.due_date, view.position),
        )[:3]
        tickets = await self._uow.requests.for_user(actor.id, kind=RequestKind.EQUIPMENT, limit=1)
        return EquipmentOverview(
            items=items, meanwhile=meanwhile, ticket=to_request(tickets[0]) if tickets else None
        )

    async def create_it_ticket(
        self,
        actor: CurrentUser,
        *,
        category: str,
        description: str,
        idempotency_key: str,
        source: RequestSource,
    ) -> RequestView:
        if (
            existing := await self._existing(actor, idempotency_key, RequestKind.EQUIPMENT)
        ) is not None:
            return to_request(existing)
        plan_item = await self._uow.plan.find_by_action(actor.id, kind=ActionKind.EQUIPMENT)
        return await self._create(
            actor,
            kind=RequestKind.EQUIPMENT,
            title=f"Обращение в IT: {category}",
            payload={"category": category, "description": description},
            approver=IT_SERVICE,
            plan_item_id=plan_item.id if plan_item else None,
            idempotency_key=idempotency_key,
            source=source,
        )

    # ---- lifecycle ---------------------------------------------------------------------------

    async def cancel(self, actor: CurrentUser, request_id: UUID) -> RequestView:
        request = await self._uow.requests.get(request_id, for_update=True)
        if request is None or request.user_id != actor.id:
            raise RequestNotFoundError()
        if request.status is RequestStatus.SUBMITTED:
            if not request.payload.get("cancel_requested"):
                request.payload = {**request.payload, "cancel_requested": True}
                request.decision_comment = "Отмена запрошена; ожидаем ответ корпоративного сервиса."
                self._uow.outbox.add(Topic.REQUEST_CANCEL, {"request_id": str(request.id)})
                self._uow.ops.audit(
                    AuditAction.REQUEST_CANCELLED,
                    actor_id=actor.id,
                    target_type="request",
                    target_id=str(request.id),
                )
                await self._uow.flush()
            return to_request(request, await self._uow.requests.events([request.id]))
        await self._set_status(
            request, RequestStatus.CANCELLED, RequestSource.USER, "Отменено сотрудником"
        )
        self._uow.ops.audit(
            AuditAction.REQUEST_CANCELLED,
            actor_id=actor.id,
            target_type="request",
            target_id=str(request.id),
        )
        await self._uow.flush()
        return to_request(request, await self._uow.requests.events([request.id]))

    async def remind(self, actor: CurrentUser, request_id: UUID) -> RequestView:
        request = await self._uow.requests.get(request_id, for_update=True)
        if request is None or request.user_id != actor.id:
            raise RequestNotFoundError()
        if (
            request.status is not RequestStatus.SUBMITTED
            or request.external_id is None
            or request.kind is not RequestKind.ACCESS
        ):
            raise RequestTransitionError(
                "Only an access request waiting for approval can be reminded about"
            )
        now = utcnow()
        if request.last_reminded_at and now - request.last_reminded_at < REMIND_COOLDOWN:
            raise RemindTooSoonError()
        if request.kind is RequestKind.ACCESS:
            self._uow.outbox.add(
                Topic.REQUEST_REMIND,
                {
                    "request_id": str(request.id),
                    "idempotency_key": f"remind:{request.id}:{now.isoformat()}",
                },
            )
        request.last_reminded_at = now
        self._uow.requests.add_event(
            request,
            status=request.status,
            source=RequestSource.USER,
            note="Напоминание поставлено в очередь отправки",
        )
        await self._uow.flush()
        return to_request(request, await self._uow.requests.events([request.id]))

    async def apply_decision(
        self,
        *,
        external_id: str,
        status: CorpTicketStatus,
        comment: str | None,
        source: RequestSource,
        service: str | None = None,
        idempotency_key: str | None = None,
    ) -> RequestView | None:
        """A service decided (webhook or reconciliation). Repeated delivery is a no-op."""
        request = await self._uow.requests.by_external_id(external_id)
        if request is None:
            logger.warning("decision for unknown request %s", external_id)
            return None
        expected_service = {
            RequestKind.ACCESS: "access",
            RequestKind.ABSENCE: "absence",
            RequestKind.EQUIPMENT: "itsupport",
        }[request.kind]
        if (service is not None and service != expected_service) or (
            idempotency_key is not None and idempotency_key != request.idempotency_key
        ):
            logger.warning("ignoring mismatched decision for %s", external_id)
            return None
        new_status = _CORP_TO_STATUS.get(status)
        if new_status is None or request.status is new_status:
            return to_request(request)
        if request.status is not RequestStatus.SUBMITTED:
            logger.info("ignoring %s for %s in status %s", status, external_id, request.status)
            return to_request(request)
        request.decision_comment = comment
        await self._set_status(request, new_status, source, comment)
        await self._uow.flush()
        return to_request(request, await self._uow.requests.events([request.id]))

    async def mark_submitted(self, request: ServiceRequest, ticket: CorpTicket) -> None:
        request.external_id = ticket.external_id
        sla = ticket.sla_hours or _SLA_HOURS[request.kind]
        request.sla_due_at = utcnow() + timedelta(hours=sla)
        if ticket.approver:
            request.approver = ticket.approver
        await self._set_status(
            request,
            RequestStatus.SUBMITTED,
            RequestSource.WORKER,
            f"Зарегистрирована: {ticket.external_id}",
        )
        if (decided := _CORP_TO_STATUS.get(ticket.status)) is not None:
            request.decision_comment = ticket.comment
            await self._set_status(request, decided, RequestSource.WORKER, ticket.comment)

    async def mark_failed(self, request: ServiceRequest, reason: str) -> None:
        if request.status not in OPEN_STATUSES:
            return
        request.decision_comment = reason
        await self._set_status(request, RequestStatus.FAILED, RequestSource.WORKER, reason)

    # ---- internals ---------------------------------------------------------------------------

    async def _existing(
        self,
        actor: CurrentUser,
        key: str,
        kind: RequestKind,
    ) -> ServiceRequest | None:
        # Serialize duplicate checks and inserts per employee, including different keys/resources.
        await self._uow.people.get(actor.id, for_update=True)
        existing = await self._uow.requests.by_idempotency_key(key)
        if existing is not None and (existing.user_id != actor.id or existing.kind is not kind):
            raise ConflictError("Ключ идемпотентности уже использован для другой заявки")
        return existing

    async def _create(
        self,
        actor: CurrentUser,
        *,
        kind: RequestKind,
        title: str,
        payload: dict[str, Any],
        approver: str | None,
        plan_item_id: UUID | None,
        idempotency_key: str,
        source: RequestSource,
    ) -> RequestView:
        request = ServiceRequest(
            user_id=actor.id,
            kind=kind,
            status=RequestStatus.SUBMITTING,
            title=title,
            payload=payload,
            approver=approver,
            plan_item_id=plan_item_id,
            idempotency_key=idempotency_key,
        )
        self._uow.requests.add(request)
        await self._uow.flush()
        self._uow.requests.add_event(request, status=RequestStatus.SUBMITTING, source=source)
        self._uow.outbox.add(Topic.REQUEST_SUBMIT, {"request_id": str(request.id)})
        if plan_item_id is not None:
            await PlanService(self._uow).link_request(plan_item_id, request.id)
        self._uow.ops.audit(
            AuditAction.REQUEST_CREATED,
            actor_id=actor.id,
            target_type="request",
            target_id=str(request.id),
            details={"kind": kind.value, "source": source.value, "payload": payload},
        )
        self._uow.ops.track(
            AnalyticsEvent.REQUEST_CREATED,
            user_id=actor.id,
            properties={"kind": kind.value, "source": source.value},
        )
        await self._uow.flush()
        return to_request(request, await self._uow.requests.events([request.id]))

    async def _set_status(
        self,
        request: ServiceRequest,
        new_status: RequestStatus,
        source: RequestSource,
        note: str | None,
    ) -> None:
        ensure_transition(request.status, new_status)
        request.status = new_status
        self._uow.requests.add_event(request, status=new_status, source=source, note=note)
        if new_status in OPEN_STATUSES:
            push(self._uow, request.user_id, RealtimeEvent.REQUEST, _event(request))
            if new_status is RequestStatus.SUBMITTED:
                await notify(
                    self._uow,
                    user_id=request.user_id,
                    kind=NotificationKind.REQUEST_UPDATED,
                    title=f"{request.title}: {STATUS_TITLES[new_status].lower()}",
                    body=_status_body(request),
                    link=f"/requests/{request.id}",
                    payload=_event(request),
                )
            return
        request.resolved_at = utcnow()
        self._uow.ops.track(
            AnalyticsEvent.REQUEST_RESOLVED,
            user_id=request.user_id,
            properties={"kind": request.kind.value, "status": new_status.value},
        )
        self._uow.ops.audit(
            AuditAction.REQUEST_STATUS,
            actor_id=None,
            target_type="request",
            target_id=str(request.id),
            details={"status": new_status.value, "source": source.value, "note": note},
        )
        next_step: PlanItemView | None = None
        if request.plan_item_id is not None:
            await PlanService(self._uow).request_resolved(
                request.plan_item_id,
                approved=new_status is RequestStatus.APPROVED,
                request_id=request.id,
            )
            overview = await PlanService(self._uow).overview(request.user_id)
            next_step = overview.next_steps[0] if overview.next_steps else None
        if new_status is not RequestStatus.CANCELLED:
            body = _status_body(request)
            if next_step is not None and new_status is RequestStatus.APPROVED:
                body += f" Следующий шаг: «{next_step.title}»."
            await notify(
                self._uow,
                user_id=request.user_id,
                kind=NotificationKind.REQUEST_UPDATED,
                title=f"{request.title}: {STATUS_TITLES[new_status].lower()}",
                body=body,
                link=f"/requests/{request.id}",
                payload={**_event(request), "next_step": str(next_step.id) if next_step else None},
            )
        push(self._uow, request.user_id, RealtimeEvent.REQUEST, _event(request))

    async def _approver(self, resource: AccessResource, user: User) -> str:
        if resource.approver_role is ApproverRole.DEVOPS:
            return "Дежурный DevOps платформы"
        team_id = resource.team_id or user.team_id
        lead = await self._uow.people.team_lead(team_id) if team_id else None
        if resource.approver_role is ApproverRole.OWNER:
            return f"Владелец ресурса ({lead.full_name})" if lead else "Владелец ресурса"
        return f"{lead.full_name}, руководитель команды" if lead else "Руководитель команды"

    async def _user(self, user_id: UUID) -> User:
        user = await self._uow.people.get(user_id)
        if user is None:
            raise UserNotFoundError()
        return user


def _dates(start: date, end: date) -> str:
    return f"{start:%d.%m.%Y}" if start == end else f"{start:%d.%m.%Y} — {end:%d.%m.%Y}"


def _event(request: ServiceRequest) -> dict[str, Any]:
    return {
        "request_id": str(request.id),
        "external_id": request.external_id,
        "kind": request.kind.value,
        "status": request.status.value,
        "title": request.title,
    }


def _status_body(request: ServiceRequest) -> str:
    match request.status:
        case RequestStatus.SUBMITTED:
            return f"Номер {request.external_id}. Согласует: {request.approver or '—'}."
        case RequestStatus.APPROVED:
            comment = (request.decision_comment or "").strip().rstrip(".")
            return f"Готово. {comment}." if comment else "Готово."
        case RequestStatus.REJECTED:
            reason = request.decision_comment or "причина не указана"
            return f"Причина: {reason}. Орби поможет переписать обоснование и подать снова."
        case RequestStatus.FAILED:
            return (request.decision_comment or "Сервис не ответил после нескольких попыток.") + (
                " Попробуй позже или напиши в IT-поддержку."
            )
        case _:
            return ""


async def submit_request(
    db: Database, corp: CorpServices, settings: Settings, request_id: UUID
) -> RequestStatus | None:
    """
    Send one request to its service. Idempotent: the service dedupes by our idempotency key and
    we skip anything already past `submitting`, so the inline attempt and the outbox retry can
    both run safely. Transient failures raise (the outbox retries); refusals fail the request.
    """
    async with db.unit_of_work() as uow:
        request = await uow.requests.get(request_id, for_update=True)
        if request is None or request.status is not RequestStatus.SUBMITTING:
            return request.status if request else None
        user = await uow.people.get(request.user_id)
        service = RequestService(uow, corp, access_sla_hours=settings.access_sla_hours)
        if reason := await _submission_problem(uow, request, user):
            await service.mark_failed(request, reason)
            return request.status
        assert user is not None  # noqa: S101 - checked by _submission_problem
        try:
            ticket = await _send(corp, request, user)
        except CorpRequestError as exc:
            await service.mark_failed(request, exc.detail)
            return request.status
        if ticket.idempotency_key is not None and ticket.idempotency_key != request.idempotency_key:
            await service.mark_failed(
                request, "Сервис вернул результат другой заявки. Обратись в IT-поддержку."
            )
            return request.status
        if await uow.requests.external_id_in_use(ticket.external_id):
            previous = await uow.requests.by_external_id(ticket.external_id)
            if previous is not None and previous.status in OPEN_STATUSES:
                await service.mark_failed(
                    previous,
                    (
                        "Корпоративный сервис повторно использовал номер заявки. "
                        "Её результат больше нельзя надёжно сверить; обратись в IT-поддержку."
                    ),
                )
            await service.mark_failed(
                request,
                (
                    "Сервис повторно выдал номер существующей заявки. "
                    "Состояния демо рассинхронизированы; нужен согласованный сброс обеих систем."
                ),
            )
            return request.status
        await service.mark_submitted(request, ticket)
        return request.status


async def _submission_problem(
    uow: UnitOfWork, request: ServiceRequest, user: User | None
) -> str | None:
    if user is None or user.banned_at is not None:
        return "Учётная запись недоступна: заявка не отправлена."
    if request.kind is not RequestKind.ACCESS:
        return None
    resource = await uow.requests.resource_by_slug(request.payload["resource"])
    if (
        resource is None
        or not resource_visible(to_resource(resource), role=user.role, team_id=user.team_id)
        or AccessLevel(request.payload["level"]) not in allowed_levels(user.role)
    ):
        return "Права изменились: этот доступ больше недоступен. Уточни у наставника."
    return None


async def _send(corp: CorpServices, request: ServiceRequest, user: User) -> CorpTicket:
    payload = request.payload
    match request.kind:
        case RequestKind.ACCESS:
            return await corp.access_create(
                employee=user.email,
                resource=payload["resource"],
                level=payload["level"],
                justification=payload["justification"],
                approver=request.approver or "",
                idempotency_key=request.idempotency_key,
            )
        case RequestKind.ABSENCE:
            return await corp.absence_create(
                employee=user.email,
                type_=payload["type"],
                start=date.fromisoformat(payload["start_date"]),
                end=date.fromisoformat(payload["end_date"]),
                comment=payload.get("comment", ""),
                idempotency_key=request.idempotency_key,
            )
        case RequestKind.EQUIPMENT:
            return await corp.it_ticket_create(
                employee=user.email,
                category=payload["category"],
                description=payload["description"],
                idempotency_key=request.idempotency_key,
            )


async def fail_request(
    db: Database, corp: CorpServices, settings: Settings, request_id: UUID
) -> None:
    """Outbox gave up: tell the employee instead of leaving the request in limbo."""
    async with db.unit_of_work() as uow:
        request = await uow.requests.get(request_id, for_update=True)
        if request is not None:
            service = RequestService(uow, corp, access_sla_hours=settings.access_sla_hours)
            await service.mark_failed(request, "Сервис недоступен: попытки отправки исчерпаны")


async def deliver_control(
    db: Database,
    corp: CorpServices,
    settings: Settings,
    request_id: UUID,
    *,
    cancel: bool,
    idempotency_key: str | None = None,
) -> None:
    async with db.unit_of_work() as uow:
        request = await uow.requests.get(request_id, for_update=True)
        if (
            request is None
            or request.status is not RequestStatus.SUBMITTED
            or request.external_id is None
        ):
            return
        current = await reconcile_ticket(corp, request)
        service = RequestService(uow, corp, access_sla_hours=settings.access_sla_hours)
        if current is not None and current.status in _CORP_TO_STATUS:
            await service.apply_decision(
                external_id=request.external_id,
                status=current.status,
                comment=current.comment,
                source=RequestSource.WORKER,
                idempotency_key=current.idempotency_key,
            )
            return
        if not cancel:
            await corp.access_remind(request.external_id, idempotency_key=idempotency_key)
            return
        ticket = await corp.cancel_request(request.external_id)
        await service.apply_decision(
            external_id=request.external_id,
            status=ticket.status,
            comment=ticket.comment,
            source=RequestSource.WORKER,
            idempotency_key=ticket.idempotency_key,
        )


async def fail_control(db: Database, request_id: UUID) -> None:
    async with db.unit_of_work() as uow:
        request = await uow.requests.get(request_id, for_update=True)
        if request is None or request.status is not RequestStatus.SUBMITTED:
            return
        request.payload = {k: v for k, v in request.payload.items() if k != "cancel_requested"}
        request.decision_comment = (
            "Сервис не подтвердил отмену или напоминание. "
            "Повтори позже или обратись в IT-поддержку."
        )
        await notify(
            uow,
            user_id=request.user_id,
            kind=NotificationKind.REQUEST_UPDATED,
            title="Не удалось передать действие корпоративному сервису",
            body=(
                "Отмена или напоминание не подтверждены. Повтори позже или обратись в IT-поддержку."
            ),
            link=f"/requests/{request.id}",
        )


async def reconcile_ticket(corp: CorpServices, request: ServiceRequest) -> CorpTicket | None:
    """Ask the service directly about a request whose webhook may have been lost."""
    if request.external_id is None:
        return None
    match request.kind:
        case RequestKind.ACCESS:
            ticket = await corp.access_get(request.external_id)
        case RequestKind.ABSENCE:
            ticket = await corp.absence_get(request.external_id)
        case RequestKind.EQUIPMENT:
            ticket = await corp.it_ticket_get(request.external_id)
    if ticket.idempotency_key is not None and ticket.idempotency_key != request.idempotency_key:
        raise CorpRequestError(
            "Сервис вернул другую заявку после сброса демо. Обратись в IT-поддержку."
        )
    return ticket


def _local_time(value: datetime) -> datetime:
    return value.replace(tzinfo=LOCAL_TZ) if value.tzinfo is None else value.astimezone(LOCAL_TZ)


def equipment_is_late(item: EquipmentItem, on: date) -> bool:
    return item.status is EquipmentStatus.DELAYED or (
        item.status in {EquipmentStatus.ORDERED, EquipmentStatus.IN_TRANSIT}
        and item.eta is not None
        and item.eta < on
    )
