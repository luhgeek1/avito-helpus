"""Shared pieces of action tools: the confirmation card and sending a saved request."""

import logging
from typing import Any

from pydantic_ai import ApprovalRequired, RunContext

from app.domain.assistant import ActionCard
from app.domain.corp import CorpUnavailableError
from app.domain.requests import RequestStatus, RequestView
from app.service.assistant.deps import AgentDeps
from app.service.mappers import to_request
from app.service.requests import submit_request

logger = logging.getLogger(__name__)

Ctx = RunContext[AgentDeps]


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
