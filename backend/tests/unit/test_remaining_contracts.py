from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from pydantic import ValidationError
from pydantic_ai import ModelRequest, RetryPromptPart, ToolReturnPart, UserPromptPart
from pydantic_ai.exceptions import PydanticAIDeprecationWarning

from app.cli import _SeedSettings
from app.core.errors import ForbiddenError
from app.domain.corp import CorpTicket, CorpTicketStatus, CorpUnavailableError
from app.domain.escalations import EscalationStatus, EscalationView
from app.domain.requests import RequestKind, RequestStatus, _score
from app.domain.users import CurrentUser, Role, can_view_member
from app.infra import corp_mcp
from app.service.assistant import offline, tools
from app.service.assistant.deps import TOOL_PERMISSIONS
from app.service.nudges import Nudges
from app.service.ops import AnalyticsService
from app.service.plan import PlanService
from app.service.requests import _status_body, deliver_control, reconcile_ticket
from tests.conftest import build_settings


def test_pure_boundary_contracts() -> None:
    assert _SeedSettings(_env_file=None, database_url="test").analytics_export_key is None
    with pytest.raises(ValidationError, match=r"CSRF_HMAC_KEY.*CORP_WEBHOOK_SECRET"):
        build_settings(
            app_stage="prod", csrf_hmac_key="change-me", corp_webhook_secret="dev-webhook-secret"
        )
    actor = CurrentUser(uuid4(), Role.LEAD, uuid4())
    assert can_view_member(actor, SimpleNamespace(id=uuid4(), lead_id=actor.id, mentor_id=None))
    assert can_view_member(actor, SimpleNamespace(id=actor.id))
    assert _score(SimpleNamespace(slug="", name="", system="", aliases=[]), {"test"}) == 0
    assert _status_body(SimpleNamespace(status=RequestStatus.CANCELLED)) == ""
    assert not AnalyticsService(Mock()).track_ui(actor, "unknown", {})
    now = datetime.now(UTC)
    view = SimpleNamespace(status=EscalationStatus.OPEN, due_at=now - timedelta(seconds=1))
    assert EscalationView.is_overdue(view, now)
    assert len(Nudges(Mock(), Mock(), build_settings()).jobs()) == 6


def test_offline_retry_mentor_greeting_and_sensitive_handoff() -> None:
    day = datetime.now(UTC).date()
    assert "подопечных" in offline.route("Привет", set(TOOL_PERMISSIONS), day).text
    assert offline._intent_plan("unknown", "unknown", set()) is None
    assert offline._intent_sensitive("Хочу уволиться".lower(), "Хочу уволиться", set()) is None
    info = SimpleNamespace(function_tools=[])
    with pytest.warns(PydanticAIDeprecationWarning, match="RetryPromptPart"):
        retry = RetryPromptPart("invalid")
    reply = offline.respond([ModelRequest(parts=[retry])], info, today_fn=lambda: day)
    assert "Не получилось" in reply.parts[0].content
    follow = offline._follow_up(
        [ToolReturnPart("search_knowledge", {"sensitive": "conflict"}, "call")],
        {"ask_mentor"},
        [ModelRequest(parts=[UserPromptPart("Нужна помощь")])],
    )
    assert follow.tool_name == "ask_mentor"
    assert follow.args_as_dict()["kind"] == "sensitive"


async def test_offline_model_nonstreaming_function() -> None:
    from pydantic_ai import Agent  # noqa: PLC0415

    result = await Agent(offline.build_offline_model(lambda: datetime.now(UTC).date())).run(
        "Привет"
    )
    assert result.output.startswith("Привет! Я Орби")


async def test_mcp_transport_exception_is_domain_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(corp_mcp, "Client", Mock(side_effect=RuntimeError("broken transport")))
    with pytest.raises(CorpUnavailableError, match="service unavailable"):
        await corp_mcp.McpCorpServices("memory://test", timeout_sec=1).absence_balance(
            employee="test"
        )


async def test_reconcile_each_service_and_control_of_missing_request() -> None:
    ticket = CorpTicket("ABS-1", CorpTicketStatus.APPROVED)
    corp = SimpleNamespace(
        absence_get=AsyncMock(return_value=ticket), it_ticket_get=AsyncMock(return_value=ticket)
    )
    for kind in (RequestKind.ABSENCE, RequestKind.EQUIPMENT):
        assert (
            await reconcile_ticket(
                corp, SimpleNamespace(kind=kind, external_id="ABS-1", idempotency_key="key")
            )
            is ticket
        )

    @asynccontextmanager
    async def unit_of_work():
        yield SimpleNamespace(requests=SimpleNamespace(get=AsyncMock(return_value=None)))

    await deliver_control(
        SimpleNamespace(unit_of_work=unit_of_work), corp, build_settings(), uuid4(), cancel=True
    )


async def test_plan_transition_missing_row_and_approved_review_comment() -> None:
    from app.domain.plan import ItemStatus, PlanItemNotFoundError, Transition  # noqa: PLC0415

    service = PlanService(SimpleNamespace(plan=SimpleNamespace(get=AsyncMock(return_value=None))))
    actor = CurrentUser(uuid4(), Role.MENTOR, uuid4())
    with pytest.raises(PlanItemNotFoundError):
        await service._load_for(actor, uuid4())
    item = SimpleNamespace()
    PlanService._apply(
        item, object(), ItemStatus.DONE, Transition.APPROVE, actor=actor, comment="Reviewed"
    )
    assert item.review_comment == "Reviewed"
    assert item.confirmed_by_id == actor.id


async def test_tool_transition_error_is_actionable(monkeypatch: pytest.MonkeyPatch) -> None:
    row = (
        SimpleNamespace(status="todo", id=uuid4()),
        SimpleNamespace(title="Synthetic step", slug="synthetic"),
    )

    @asynccontextmanager
    async def unit_of_work():
        yield SimpleNamespace(plan=SimpleNamespace(items=AsyncMock(return_value=[row])))

    ctx = SimpleNamespace(
        deps=SimpleNamespace(
            db=SimpleNamespace(unit_of_work=unit_of_work),
            actor=CurrentUser(uuid4(), Role.INTERN, uuid4()),
        )
    )
    monkeypatch.setattr(
        tools.PlanService, "transition", AsyncMock(side_effect=ForbiddenError("Needs approval"))
    )
    result = await tools.update_plan_step(ctx, "Synthetic step", "complete")
    assert result["error"] == "FORBIDDEN"
    assert "Needs approval" in result["message"]
