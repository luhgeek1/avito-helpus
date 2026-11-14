import logging
from datetime import date
from typing import Any, Literal
from uuid import UUID

from pydantic_ai import ApprovalRequired, FunctionToolset, RunContext
from pydantic_ai.tools import ToolDefinition

from app.core.clock import LOCAL_TZ
from app.core.errors import DomainError
from app.domain.absence import ABSENCE_TITLES, AbsenceType
from app.domain.assistant import ActionCard, CardField
from app.domain.corp import CorpUnavailableError
from app.domain.escalations import LEVEL_TITLES, Chain, EscalationKind, first_assignment
from app.domain.events import Topic
from app.domain.knowledge import (
    PRIVATE_TOPICS,
    SENSITIVE_TITLES,
    SYNTHETIC_LABEL,
    coverage,
    detect_sensitive,
)
from app.domain.plan import STAGE_TITLES, ActionKind, ItemStatus, Transition
from app.domain.requests import LEVEL_TITLES as ACCESS_LEVEL_TITLES
from app.domain.requests import (
    AccessLevel,
    RequestSource,
    RequestStatus,
    RequestView,
    match_resources,
)
from app.service.assistant.deps import TOOL_PERMISSIONS, AgentDeps
from app.service.escalations import KIND_TITLES, EscalationService
from app.service.knowledge import KnowledgeService, viewer_of
from app.service.mappers import to_request
from app.service.mentor import MentorService
from app.service.plan import PlanService
from app.service.requests import (
    IT_SERVICE,
    AccessOutcome,
    AccessPreparation,
    RequestService,
    equipment_is_late,
    submit_request,
)

logger = logging.getLogger(__name__)

Ctx = RunContext[AgentDeps]
RELEVANT = 0.34
EXCERPT = 600


def _card(card: ActionCard, args: dict[str, Any]) -> ApprovalRequired:
    """Defer the call: the run stops, the user sees the card, the canonical args are kept."""
    return ApprovalRequired(metadata={"card": card.as_dict(), "args": args})


def request_part(view: RequestView) -> dict[str, Any]:
    return {
        "id": str(view.id),
        "kind": view.kind.value,
        "title": view.title,
        "status": view.status.value,
        "status_title": view.status_title,
        "external_id": view.external_id,
        "approver": view.approver,
        "decision_comment": view.decision_comment,
        "sla_due_at": view.sla_due_at.isoformat() if view.sla_due_at else None,
    }


async def _submit_now(ctx: Ctx, view: RequestView) -> RequestView:
    """First delivery attempt right away; the outbox retries if the service is down."""
    deps = ctx.deps
    try:
        await submit_request(deps.db, deps.corp, deps.settings, view.id)
    except CorpUnavailableError:
        logger.info("service unavailable, request %s left for the outbox", view.id)
    async with deps.db.unit_of_work() as uow:
        row = await uow.requests.get(view.id)
        events = await uow.requests.events([view.id])
        return to_request(row, events) if row else view


def _request_message(view: RequestView) -> str:
    if view.status is RequestStatus.SUBMITTED:
        return (
            f"Готово: заявка {view.external_id} отправлена, согласует {view.approver}. "
            "Сообщу, как только будет решение — статус виден в «Моих заявках»."
        )
    if view.status is RequestStatus.APPROVED:
        return f"Заявка {view.external_id} уже одобрена."
    if view.status is RequestStatus.FAILED:
        return f"Сервис отказал в регистрации заявки: {view.decision_comment}."
    return (
        "Заявку сохранил, но сервис сейчас не отвечает — отправлю автоматически, как только он "
        "оживёт, и пришлю уведомление."
    )


# ---- plan --------------------------------------------------------------------------------------


async def get_my_plan(ctx: Ctx) -> dict[str, Any]:
    """The intern's adaptation plan: current stage, progress, overdue steps and the next steps."""
    async with ctx.deps.db.unit_of_work() as uow:
        overview = await PlanService(uow).overview(ctx.deps.actor.id, on=ctx.deps.today)
    steps: list[dict[str, Any]] = [
        {
            "id": str(s.id),
            "title": s.title,
            "due": s.due_date.isoformat(),
            "status": s.status.value,
            "overdue": s.is_overdue(ctx.deps.today),
            "action": dict(s.action) if s.action else None,
        }
        for s in overview.next_steps
    ]
    ctx.deps.emit(
        "plan",
        {"next_steps": steps, "percent": overview.percent, "stage": overview.current_stage.value},
    )
    lines = [f"«{s['title']}» — до {date.fromisoformat(s['due']):%d.%m}" for s in steps]
    message = (
        f"Сейчас этап «{STAGE_TITLES[overview.current_stage]}», выполнено {overview.done} из "
        f"{overview.total} ({overview.percent}%)."
        + (f" Просрочено: {overview.overdue}." if overview.overdue else "")
        + (
            "\nСледующие шаги:\n" + "\n".join(f"{i}. {line}" for i, line in enumerate(lines, 1))
            if lines
            else ""
        )
    )
    return {
        "message": message,
        "stage": overview.current_stage.value,
        "percent": overview.percent,
        "next_steps": steps,
    }


async def update_plan_step(
    ctx: Ctx, step: str, action: Literal["start", "complete", "block"], comment: str | None = None
) -> dict[str, Any]:
    """Change the status of one of the user's own plan steps. `step` is its title or part of it."""
    async with ctx.deps.db.unit_of_work() as uow:
        rows = await uow.plan.items(ctx.deps.actor.id)
        open_rows = [(i, t) for i, t in rows if i.status is not ItemStatus.DONE]
        best = max(
            open_rows, key=lambda r: coverage(step, f"{r[1].title} {r[1].slug}"), default=None
        )
        if best is None or coverage(step, f"{best[1].title} {best[1].slug}") < RELEVANT:
            return {"message": f"Не нашёл в плане незакрытый шаг «{step}». Уточни название."}
        try:
            view = await PlanService(uow).transition(
                ctx.deps.actor, best[0].id, Transition(action), comment=comment
            )
        except DomainError as exc:
            return {"message": f"Не получилось: {exc.detail}", "error": exc.error_code.value}
    titles = {
        "start": "в работе",
        "complete": "выполнен",
        "block": "заблокирован, наставник в курсе",
    }
    ctx.deps.emit("plan", {"updated": {"id": str(view.id), "status": view.status.value}})
    return {"message": f"Шаг «{view.title}» — {titles[action]}.", "status": view.status.value}


# ---- knowledge ---------------------------------------------------------------------------------


async def search_knowledge(ctx: Ctx, query: str) -> dict[str, Any]:
    """Search company and team documentation the user may read. Returns numbered sources."""
    if topic := detect_sensitive(query):
        handoff = (
            "Про чужие данные я не рассказываю и никому такие вопросы не передаю; "
            "про своё вознаграждение можно спросить руководителя или HRBP."
            if topic in PRIVATE_TOPICS
            else "Могу конфиденциально передать вопрос HRBP."
        )
        return {
            "message": (
                f"Это деликатная тема ({SENSITIVE_TITLES[topic]}), её я не обсуждаю. {handoff}"
            ),
            "sensitive": topic,
            "sources": [],
        }
    async with ctx.deps.db.unit_of_work() as uow:
        result = await KnowledgeService(uow, ctx.deps.embeddings).search(
            viewer_of(ctx.deps.actor), query, user_id=ctx.deps.actor.id
        )
    relevant = [
        h
        for h in result.hits
        if coverage(query, f"{h.heading} {h.content} {h.document_title}") >= RELEVANT
    ]
    sources = [
        {
            "n": n,
            "document": h.document_slug,
            "title": h.document_title,
            "section": h.heading,
            "excerpt": h.content[:EXCERPT],
            "scope": h.scope.value,
            "team": h.team_name,
            "label": h.source_label,
            "synthetic": h.source_label == SYNTHETIC_LABEL,
            "url": h.source_url,
            "updated_at": h.updated_at.isoformat(),
            "stale": h.is_stale(ctx.deps.today),
        }
        for n, h in enumerate(relevant, 1)
    ]
    conflicts = [
        {
            "id": str(c.id),
            "topic": c.topic,
            "summary": c.summary,
            "company": {
                "title": c.company.document_title,
                "section": c.company.heading,
                "excerpt": c.company.content[:EXCERPT],
            },
            "team": {
                "title": c.team.document_title,
                "section": c.team.heading,
                "team": c.team.team_name,
                "excerpt": c.team.content[:EXCERPT],
            },
        }
        for c in result.conflicts
        if any(s["section"] in {c.company.heading, c.team.heading} for s in sources)
    ]
    ctx.deps.emit(
        "sources", {"query": query, "sources": sources, "conflicts": conflicts, "mode": result.mode}
    )
    if not sources:
        return {
            "message": (
                "В базе знаний не нашёл ответа на это. Могу задать вопрос наставнику — он увидит "
                "контекст и ответит, а ответ можно сохранить в FAQ команды."
            ),
            "found": False,
            "sources": [],
        }
    top = sources[0]
    message = f"Нашёл в «{top['title']}», раздел «{top['section']}» [1]:\n{top['excerpt']}"
    if len(sources) > 1:
        message += f"\n\nЕщё по теме: «{sources[1]['title']}» [2]."
    if conflicts:
        conflict = conflicts[0]
        message += (
            "\n\nВнимание: общая инструкция и инструкция команды расходятся — "
            f"{conflict['summary']} "
            "Командное правило обычно точнее, но лучше уточнить у наставника."
        )
    return {"message": message, "found": True, "sources": sources, "conflicts": conflicts}


# ---- access ------------------------------------------------------------------------------------


async def find_access_resources(ctx: Ctx, query: str) -> dict[str, Any]:
    """Find resources in the access catalog the user may request (repos, Jira, Grafana...)."""
    async with ctx.deps.db.unit_of_work() as uow:
        service = RequestService(
            uow, ctx.deps.corp, access_sla_hours=ctx.deps.settings.access_sla_hours
        )
        catalog = await service.catalog(ctx.deps.actor)
    matches = match_resources(query, catalog)
    items = [
        {"slug": r.slug, "name": r.name, "system": r.system, "description": r.description}
        for r in matches
    ]
    if not items:
        return {"message": "Такого ресурса в доступном тебе каталоге нет.", "resources": []}
    names = ", ".join(f"{r['name']} ({r['system']})" for r in items)
    return {"message": f"Подходящие ресурсы: {names}.", "resources": items}


async def request_access(
    ctx: Ctx,
    resource: str,
    level: AccessLevel | None = None,
    justification: str | None = None,
) -> dict[str, Any]:
    """
    Request access to a resource (repository, Jira project, dashboard...). Checks visibility,
    current access and duplicates, then shows a confirmation card; nothing is sent before approval.

    Args:
        resource: Resource name, slug or the user's words, e.g. "listings-api".
        level: Leave empty unless the user asked for a level: the default is what the team has.
        justification: Why the access is needed, in the user's words; leave empty to propose one.
    """
    deps = ctx.deps
    async with deps.db.unit_of_work() as uow:
        service = RequestService(uow, deps.corp, access_sla_hours=deps.settings.access_sla_hours)
        try:
            if not ctx.tool_call_approved:
                prep = await service.prepare_access(
                    deps.actor, resource=resource, level=level, justification=justification
                )
            else:
                prep, view = await service.create_access(
                    deps.actor,
                    resource=resource,
                    level=level,
                    justification=justification,
                    idempotency_key=ctx.tool_call_id or "",
                    source=RequestSource.AGENT,
                )
        except DomainError as exc:
            return {"message": f"{exc.detail}.", "error": exc.error_code.value}

    if not ctx.tool_call_approved:
        if prep.outcome is AccessOutcome.ALREADY_GRANTED and prep.resource:
            outcome = _access_outcome(prep)
            if await _close_access_step(ctx, prep.resource.slug):
                outcome["message"] += " Отметил шаг плана выполненным."
            return outcome
        if prep.outcome is AccessOutcome.READY and prep.resource and prep.level:
            raise _card(
                prep.card(),
                {
                    "resource": prep.resource.slug,
                    "level": prep.level.value,
                    "justification": prep.justification,
                },
            )
        return _access_outcome(prep)

    if view is None:
        return _access_outcome(prep)
    view = await _submit_now(ctx, view)
    deps.emit("request", request_part(view))
    return {"message": _request_message(view), "request": request_part(view)}


async def _close_access_step(ctx: Ctx, resource: str) -> bool:
    """The access already exists, so the matching plan step is done: no busywork for the intern."""
    async with ctx.deps.db.unit_of_work() as uow:
        item = await uow.plan.find_by_action(
            ctx.deps.actor.id, kind=ActionKind.ACCESS_REQUEST, resource=resource
        )
        if item is None:
            return False
        await PlanService(uow).complete_by_system(item.id, note="Доступ уже выдан")
        return True


def _access_outcome(prep: AccessPreparation) -> dict[str, Any]:
    name = prep.resource.name if prep.resource else ""
    if prep.outcome is AccessOutcome.ALREADY_GRANTED and prep.grant is not None:
        level = prep.grant.level or AccessLevel.READ.value
        title = ACCESS_LEVEL_TITLES.get(AccessLevel(level), level)
        since = f" с {prep.grant.granted_at:%d.%m.%Y}" if prep.grant.granted_at else ""
        return {
            "message": f"У тебя уже есть доступ к {name} ({title}){since}. Заявка не нужна.",
            "outcome": prep.outcome.value,
        }
    if prep.outcome is AccessOutcome.PENDING_EXISTS and prep.existing is not None:
        number = prep.existing.external_id or "отправляется"
        return {
            "message": f"Заявка на {name} уже в работе: {number}, "
            f"статус — {prep.existing.status_title.lower()}.",
            "outcome": prep.outcome.value,
            "request": request_part(prep.existing),
        }
    if prep.outcome is AccessOutcome.AMBIGUOUS:
        options = ", ".join(f"{c.name} ({c.system})" for c in prep.candidates)
        return {
            "message": f"Уточни, какой ресурс нужен: {options}?",
            "outcome": prep.outcome.value,
            "candidates": [c.slug for c in prep.candidates],
        }
    return {
        "message": "Такой ресурс я не нашёл или он недоступен для твоей роли. "
        "Уточни у наставника, какой доступ нужен — могу задать ему вопрос.",
        "outcome": AccessOutcome.NOT_FOUND.value,
    }


async def my_requests(ctx: Ctx, status: RequestStatus | None = None) -> dict[str, Any]:
    """The user's requests to corporate services with their statuses."""
    async with ctx.deps.db.unit_of_work() as uow:
        service = RequestService(
            uow, ctx.deps.corp, access_sla_hours=ctx.deps.settings.access_sla_hours
        )
        views = await service.requests(ctx.deps.actor, status=status)
    items = [request_part(v) for v in views[:8]]
    for item in items[:3]:
        ctx.deps.emit("request", item)
    if not items:
        return {"message": "Заявок пока нет.", "requests": []}
    lines = [
        f"{v['title']} — {v['status_title'].lower()}"
        + (f" ({v['external_id']})" if v["external_id"] else "")
        for v in items
    ]
    return {
        "message": "Твои заявки:\n" + "\n".join(f"• {line}" for line in lines),
        "requests": items,
    }


# ---- absence -----------------------------------------------------------------------------------


async def check_absence(
    ctx: Ctx, absence_type: AbsenceType, start_date: date, end_date: date
) -> dict[str, Any]:
    """Check a day off or vacation: days left, test-instruction rules and meeting conflicts."""
    async with ctx.deps.db.unit_of_work() as uow:
        service = RequestService(
            uow, ctx.deps.corp, access_sla_hours=ctx.deps.settings.access_sla_hours
        )
        try:
            check = await service.check_absence(
                ctx.deps.actor, type_=absence_type, start=start_date, end=end_date
            )
        except DomainError as exc:
            return {"message": exc.detail, "error": exc.error_code.value}
    message = (
        f"{check.title}: {check.working_days} раб. дн., "
        f"останется {check.balance_after} из {check.balance}."
    )
    if check.warnings:
        message += "\n" + "\n".join(f"⚠ {w}" for w in check.warnings)
    return {
        "message": message,
        "working_days": check.working_days,
        "balance_after": check.balance_after,
        "warnings": check.warnings,
    }


async def request_absence(
    ctx: Ctx,
    absence_type: AbsenceType,
    start_date: date,
    end_date: date,
    comment: str = "",
) -> dict[str, Any]:
    """File a day off or vacation request (after a confirmation card with warnings)."""
    deps = ctx.deps
    async with deps.db.unit_of_work() as uow:
        service = RequestService(uow, deps.corp, access_sla_hours=deps.settings.access_sla_hours)
        try:
            if not ctx.tool_call_approved:
                check = await service.check_absence(
                    deps.actor, type_=absence_type, start=start_date, end=end_date
                )
                card = await service.absence_card(
                    deps.actor, check, comment or f"{ABSENCE_TITLES[absence_type]} по личным делам"
                )
            else:
                view = await service.create_absence(
                    deps.actor,
                    type_=absence_type,
                    start=start_date,
                    end=end_date,
                    comment=comment,
                    idempotency_key=ctx.tool_call_id or "",
                    source=RequestSource.AGENT,
                )
        except DomainError as exc:
            return {"message": exc.detail, "error": exc.error_code.value}
    if not ctx.tool_call_approved:
        raise _card(
            card,
            {
                "type": absence_type.value,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "comment": comment or f"{ABSENCE_TITLES[absence_type]} по личным делам",
            },
        )
    view = await _submit_now(ctx, view)
    deps.emit("request", request_part(view))
    message = _request_message(view)
    if view.status is RequestStatus.SUBMITTED:
        message += " Когда одобрят, могу написать команде в канал."
    return {"message": message, "request": request_part(view)}


# ---- equipment ---------------------------------------------------------------------------------


async def equipment_status(ctx: Ctx) -> dict[str, Any]:
    """Status of the user's laptop and other equipment: ETA, pickup place, what to do meanwhile."""
    deps = ctx.deps
    async with deps.db.unit_of_work() as uow:
        service = RequestService(uow, deps.corp, access_sla_hours=deps.settings.access_sla_hours)
        try:
            overview = await service.equipment(deps.actor)
        except CorpUnavailableError:
            return {
                "message": "IT-сервис сейчас не отвечает, статус не узнать. Попробуй чуть позже "
                "или напиши в канал #it-help.",
                "error": "unavailable",
            }
    items: list[dict[str, Any]] = [
        {
            "kind": i.kind,
            "model": i.model,
            "status": i.status.value,
            "status_title": i.status_title,
            "eta": i.eta.isoformat() if i.eta else None,
            "pickup_location": i.pickup_location,
            "pickup_hours": i.pickup_hours,
            "late": equipment_is_late(i, deps.today),
            "note": i.note,
        }
        for i in overview.items
    ]
    meanwhile = [{"id": str(s.id), "title": s.title} for s in overview.meanwhile]
    deps.emit("equipment", {"items": items, "meanwhile": meanwhile})
    if not items:
        return {
            "message": "Техника за тобой пока не числится. Уточни у руководителя, заказана ли она.",
            "items": [],
        }
    parts = []
    for item in items:
        line = f"{item['model']}: {item['status_title']}"
        if item["eta"] and item["status"] in {"ordered", "in_transit", "delayed"}:
            line += f", ожидается {date.fromisoformat(item['eta']):%d.%m}"
        if item["status"] == "ready_for_pickup":
            line += f" — забрать: {item['pickup_location']}, {item['pickup_hours']}"
        parts.append(line)
    message = "\n".join(parts)
    if any(i["late"] for i in items):
        message += "\nСрок прошёл — могу создать обращение в IT-поддержку."
    if meanwhile and any(i["status"] != "issued" for i in items):
        message += (
            "\nПока ждёшь, можно сделать: " + "; ".join(f"«{m['title']}»" for m in meanwhile) + "."
        )
    return {"message": message, "items": items, "meanwhile": meanwhile}


async def create_it_ticket(ctx: Ctx, category: str, description: str) -> dict[str, Any]:
    """Open an IT support ticket (e.g. a delayed laptop), after a confirmation card."""
    deps = ctx.deps
    if not ctx.tool_call_approved:
        card = ActionCard(
            kind="it_ticket",
            title=f"Обращение в IT: {category}",
            service=IT_SERVICE,
            fields=[
                CardField("category", "Тема", category),
                CardField("description", "Описание", description, editable=True),
            ],
            note="После подтверждения обращение уйдёт в IT-поддержку.",
        )
        raise _card(card, {"category": category, "description": description})
    async with deps.db.unit_of_work() as uow:
        service = RequestService(uow, deps.corp, access_sla_hours=deps.settings.access_sla_hours)
        view = await service.create_it_ticket(
            deps.actor,
            category=category,
            description=description,
            idempotency_key=ctx.tool_call_id or "",
            source=RequestSource.AGENT,
        )
    view = await _submit_now(ctx, view)
    deps.emit("request", request_part(view))
    return {"message": _request_message(view), "request": request_part(view)}


# ---- people ------------------------------------------------------------------------------------


async def post_team_message(ctx: Ctx, text: str) -> dict[str, Any]:
    """Post a message to the user's team channel (after a confirmation card)."""
    deps = ctx.deps
    team = deps.person.team
    if team is None or not team.channel:
        return {"message": "У тебя не указан канал команды."}
    if not ctx.tool_call_approved:
        card = ActionCard(
            kind="team_message",
            title=f"Сообщение в {team.channel}",
            service="Мессенджер",
            fields=[
                CardField("channel", "Канал", team.channel),
                CardField("text", "Текст", text, editable=True),
            ],
            note="Сообщение увидит вся команда.",
        )
        raise _card(card, {"text": text})
    async with deps.db.unit_of_work() as uow:
        uow.outbox.add(
            Topic.MESSENGER_POST,
            {
                "channel": team.channel,
                "text": text,
                "author": deps.person.email,
                "idempotency_key": ctx.tool_call_id or "",
            },
        )
    return {"message": f"Отправил сообщение в {team.channel}."}


async def ask_mentor(
    ctx: Ctx,
    question: str,
    kind: Literal["question", "blocker", "conflict", "sensitive"] = "question",
    context_note: str | None = None,
) -> dict[str, Any]:
    """
    Hand a question to a person: the mentor (then lead, then HRBP if unanswered). Use when the
    knowledge base has no answer, sources conflict, the user is blocked, or the topic is sensitive
    (kind="sensitive" goes straight to HRBP). Shows a confirmation card first.
    """
    deps = ctx.deps
    escalation_kind = EscalationKind(kind)
    if not ctx.tool_call_approved:
        async with deps.db.unit_of_work() as uow:
            user = await uow.people.get(deps.actor.id)
            chain = (
                Chain(user.mentor_id, user.lead_id, user.hrbp_id)
                if user
                else Chain(None, None, None)
            )
            try:
                assignment = first_assignment(escalation_kind, chain)
            except DomainError as exc:
                return {"message": exc.detail}
            assignee = await uow.people.get(assignment.assignee_id)
        card = ActionCard(
            kind="ask_mentor",
            title=f"{KIND_TITLES[escalation_kind]}: {LEVEL_TITLES[assignment.level]}",
            service="Орби → человек",
            fields=[
                CardField(
                    "to",
                    "Кому",
                    f"{assignee.full_name if assignee else '—'} ({LEVEL_TITLES[assignment.level]})",
                ),
                CardField("question", "Вопрос", question, editable=True),
                CardField(
                    "context", "Контекст", context_note or f"Этап: {deps.stage_title.lower()}"
                ),
            ],
            note="Если ответа не будет в срок, вопрос автоматически поднимется выше.",
        )
        raise _card(card, {"question": question, "kind": kind, "context_note": context_note})
    async with deps.db.unit_of_work() as uow:
        service = EscalationService(uow, sla_hours=deps.settings.escalation_sla_hours)
        view = await service.create(
            deps.actor,
            question=question,
            kind=escalation_kind,
            context={"note": context_note, "stage": deps.stage_title, "source": "chat"},
            conversation_id=deps.conversation_id,
        )
    deps.emit(
        "escalation",
        {
            "id": str(view.id),
            "assignee": view.assignee_name,
            "level": view.level.value,
            "due_at": view.due_at.isoformat(),
            "status": view.status.value,
        },
    )
    return {
        "message": f"Передал вопрос: {view.assignee_name}. Ответ придёт уведомлением, "
        f"ответить обещают до {view.due_at.astimezone(LOCAL_TZ):%d.%m %H:%M} по Москве.",
        "escalation_id": str(view.id),
    }


async def who_is_who(ctx: Ctx) -> dict[str, Any]:
    """The user's mentor, lead, HRBP and team channel: whom to ask about what."""
    person = ctx.deps.person
    contacts = {
        "mentor": person.mentor.full_name if person.mentor else None,
        "lead": person.lead.full_name if person.lead else None,
        "hrbp": person.hrbp.full_name if person.hrbp else None,
        "team": person.team.name if person.team else None,
        "channel": person.team.channel if person.team else None,
    }
    lines = []
    if contacts["mentor"]:
        lines.append(f"Наставник — {contacts['mentor']}: задачи, код, ревью, «как у нас принято».")
    if contacts["lead"]:
        lines.append(f"Руководитель — {contacts['lead']}: цели, отпуска и отгулы, доступы команды.")
    if contacts["hrbp"]:
        lines.append(f"HRBP — {contacts['hrbp']}: деликатные вопросы, условия, конфликты.")
    if contacts["channel"]:
        lines.append(f"Канал команды — {contacts['channel']}.")
    return {"message": "\n".join(lines) or "Контакты пока не заполнены.", "contacts": contacts}


# ---- mentor ------------------------------------------------------------------------------------


async def list_mentees(ctx: Ctx) -> dict[str, Any]:
    """Interns linked to the user (mentor, lead or HRBP) with progress and what needs attention."""
    async with ctx.deps.db.unit_of_work() as uow:
        summaries = await MentorService(uow).mentees(ctx.deps.actor)
    items = [
        {
            "id": str(s.person.id),
            "name": s.person.full_name,
            "day": s.internship_day,
            "stage": s.stage_title,
            "percent": s.percent,
            "overdue": s.overdue,
            "blocked": [b.title for b in s.blocked],
            "awaiting_review": [a.title for a in s.awaiting_review],
            "open_questions": s.open_questions,
            "attention": s.needs_attention,
        }
        for s in summaries
    ]
    if not items:
        return {"message": "Подопечных пока нет.", "mentees": []}
    lines = [
        f"{m['name']}: день {m['day'] or '—'}, {m['percent']}%"
        + (" — нужно внимание" if m["attention"] else "")
        for m in items
    ]
    return {"message": "\n".join(lines), "mentees": items}


async def open_questions(ctx: Ctx) -> dict[str, Any]:
    """Questions from interns assigned to the user and still waiting for an answer."""
    async with ctx.deps.db.unit_of_work() as uow:
        views = await EscalationService(
            uow, sla_hours=ctx.deps.settings.escalation_sla_hours
        ).assigned(ctx.deps.actor)
    items = [
        {
            "id": str(v.id),
            "from": v.user_name,
            "question": v.question,
            "kind": v.kind.value,
            "due_at": v.due_at.isoformat(),
        }
        for v in views
    ]
    if not items:
        return {"message": "Открытых вопросов нет.", "questions": []}
    return {
        "message": "\n".join(f"• {q['from']}: {q['question']}" for q in items),
        "questions": items,
    }


async def answer_question(
    ctx: Ctx, question_id: UUID, answer: str, publish_to_faq: bool = False
) -> dict[str, Any]:
    """Answer an intern's question (optionally publishing it to the team FAQ), after a card."""
    deps = ctx.deps
    if not ctx.tool_call_approved:
        card = ActionCard(
            kind="answer_question",
            title="Ответ стажёру",
            service="Орби",
            fields=[
                CardField("answer", "Ответ", answer, editable=True),
                CardField(
                    "publish_to_faq",
                    "Добавить в FAQ команды",
                    "да" if publish_to_faq else "нет",
                    editable=True,
                ),
            ],
        )
        raise _card(
            card,
            {"question_id": str(question_id), "answer": answer, "publish_to_faq": publish_to_faq},
        )
    async with deps.db.unit_of_work() as uow:
        knowledge = KnowledgeService(uow, deps.embeddings)
        try:
            view = await EscalationService(
                uow, sla_hours=deps.settings.escalation_sla_hours
            ).answer(
                deps.actor,
                question_id,
                answer=answer,
                publish_to_faq=publish_to_faq,
                knowledge=knowledge,
            )
        except DomainError as exc:
            return {"message": exc.detail}
    suffix = f" и добавлен в FAQ ({view.faq_document_slug})" if view.faq_document_slug else ""
    return {"message": f"Ответ отправлен {view.user_name}{suffix}."}


TOOL_FUNCTIONS = (
    get_my_plan,
    update_plan_step,
    search_knowledge,
    find_access_resources,
    request_access,
    my_requests,
    check_absence,
    request_absence,
    equipment_status,
    create_it_ticket,
    post_team_message,
    ask_mentor,
    who_is_who,
    list_mentees,
    open_questions,
    answer_question,
)


def _allowed(ctx: RunContext[AgentDeps], tool_def: ToolDefinition) -> bool:
    permission = TOOL_PERMISSIONS.get(tool_def.name)
    return permission is not None and ctx.deps.actor.can(permission)


def build_toolset() -> Any:
    """All tools, filtered per run by the caller's permissions before the model sees them."""
    return FunctionToolset[AgentDeps](tools=list(TOOL_FUNCTIONS)).filtered(_allowed)
