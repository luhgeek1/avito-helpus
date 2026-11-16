from typing import Any, Literal

from pydantic_ai import ApprovalRequired, RunContext

from app.core.errors import DomainError
from app.domain.assistant import ActionCard, CardField
from app.domain.requests import OPEN_STATUSES, RequestKind, RequestStatus
from app.service.assistant.deps import AgentDeps
from app.service.requests import RequestService


async def control_request(
    ctx: RunContext[AgentDeps], reference: str, action: Literal["cancel", "remind"]
) -> dict[str, Any]:
    """Cancel one's own open request or remind about a pending access request, after approval.

    reference: Exact external number (e.g. ACC-1042) or UUID from my_requests; never guess it.
    """
    deps = ctx.deps
    async with deps.db.unit_of_work() as uow:
        service = RequestService(uow, deps.corp, access_sla_hours=deps.settings.access_sla_hours)
        views = await service.requests(deps.actor)
        view = next(
            (
                v
                for v in views
                if reference.upper() == v.external_id or reference.lower() == str(v.id)
            ),
            None,
        )
        if view is None:
            return {"message": "Не нашёл у тебя такую заявку. Посмотри номер в «Моих заявках»."}
        if view.status not in OPEN_STATUSES:
            return {"message": "По этой заявке уже есть решение. Изменить её через чат нельзя."}
        if action == "remind" and (
            view.kind is not RequestKind.ACCESS or view.status is not RequestStatus.SUBMITTED
        ):
            return {"message": "Напомнить можно о заявке на доступ, которая ждёт согласования."}
        if not ctx.tool_call_approved:
            card = ActionCard(
                kind="request_control",
                title="Отменить заявку" if action == "cancel" else "Напомнить о заявке",
                service="Мои заявки",
                fields=[
                    CardField("reference", "Номер", view.external_id or str(view.id)),
                    CardField("title", "Заявка", view.title),
                    CardField("status", "Сейчас", view.status_title),
                ],
                note="Передам действие сервису. Окончательный статус появится после его ответа.",
            )
            raise ApprovalRequired(
                metadata={
                    "card": card.as_dict(),
                    "args": {"reference": str(view.id), "action": action},
                }
            )
        try:
            result = await (
                service.cancel(deps.actor, view.id)
                if action == "cancel"
                else service.remind(deps.actor, view.id)
            )
        except DomainError as exc:
            return {"message": exc.detail, "error": exc.error_code.value}
    message = "Напоминание поставлено в очередь отправки. Повторить можно через 20 часов."
    if action == "cancel":
        message = (
            "Заявка отменена."
            if result.status is RequestStatus.CANCELLED
            else "Отмена запрошена. Ждём ответ сервиса — он может успеть принять решение раньше."
        )
    return {"message": message, "status": result.status.value}
