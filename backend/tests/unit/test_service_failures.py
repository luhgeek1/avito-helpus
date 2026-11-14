"""Service failure paths which cannot be constructed with valid foreign keys."""

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from pydantic_ai import ModelRequest, UserPromptPart

from app.api.system import ready
from app.api.v1 import admin
from app.core.errors import ForbiddenError
from app.db.models import OutboxEvent
from app.domain.corp import CorpUnavailableError
from app.domain.escalations import Chain, EscalationKind, NoAssigneeError, first_assignment
from app.domain.events import OutboxStatus
from app.domain.plan import ItemStatus, PlanItemNotFoundError, Transition
from app.domain.users import CurrentUser, Role, UserNotFoundError, can_view_member
from app.service.assistant.chat import ChatService, _conversation_locked, _last_user_text
from app.service.escalations import EscalationService
from app.service.mappers import to_person_ref
from app.service.outbox import OutboxDispatcher
from app.service.people import PeopleService
from app.service.plan import PlanService
from app.service.requests import RequestService


@asynccontextmanager
async def yielding(value):
    yield value


async def test_readiness_reports_both_dependencies_when_one_fails() -> None:
    response = await ready(
        SimpleNamespace(ping=AsyncMock(side_effect=RuntimeError("offline"))),
        SimpleNamespace(ping=AsyncMock(return_value=True)),
    )
    assert response.status_code == 503
    assert b'"database":"error"' in response.body
    assert b'"redis":"ok"' in response.body


async def test_demo_reset_keeps_success_when_corporate_reset_is_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seed = AsyncMock()
    monkeypatch.setattr(admin, "seed", seed)
    db = object()
    corp = SimpleNamespace(reset_demo=AsyncMock(side_effect=CorpUnavailableError()))
    await admin._reset_demo(db, corp)
    seed.assert_awaited_once_with(db, reset=True)
    corp.reset_demo.assert_awaited_once()


async def test_unknown_outbox_topic_is_dead_with_diagnostic() -> None:
    event = OutboxEvent(id=uuid4(), topic="unknown", status=OutboxStatus.PENDING, attempts=0)
    await OutboxDispatcher(Mock(), {}, batch_size=1, max_attempts=1)._handle(
        event, datetime.now(UTC)
    )
    assert event.status is OutboxStatus.DEAD
    assert "no handler" in event.last_error


async def test_missing_users_never_turn_into_anonymous_requests() -> None:
    actor = CurrentUser(uuid4(), Role.INTERN, uuid4())
    uow = SimpleNamespace(people=SimpleNamespace(get=AsyncMock(return_value=None)))
    for service in (
        PeopleService(uow),
        RequestService(uow, Mock(), access_sla_hours=24),
        EscalationService(uow, sla_hours=24),
    ):
        with pytest.raises(UserNotFoundError):
            await (
                service.user(actor.id)
                if isinstance(service, PeopleService)
                else service._user(actor.id)
            )
    assert await PeopleService(uow).team(actor) == []
    assert to_person_ref(None) is None


async def test_missing_plan_owner_denies_reviewer_and_skips_notification() -> None:
    actor = CurrentUser(uuid4(), Role.MENTOR, uuid4())
    item = SimpleNamespace(user_id=uuid4())
    template = object()
    uow = SimpleNamespace(
        people=SimpleNamespace(get=AsyncMock(return_value=None)),
        plan=SimpleNamespace(get=AsyncMock(return_value=(item, template))),
    )
    service = PlanService(uow)
    with pytest.raises(PlanItemNotFoundError):
        await service._load_for(actor, uuid4())
    await service._after_change(item, template, Transition.COMPLETE, actor=actor, comment=None)


async def test_quiz_cannot_be_taken_on_other_or_completed_step(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    actor = CurrentUser(uuid4(), Role.INTERN, uuid4())
    service = PlanService(Mock())
    item = SimpleNamespace(user_id=uuid4(), status=ItemStatus.DONE)
    monkeypatch.setattr(service, "_load_for", AsyncMock(return_value=(item, object())))
    monkeypatch.setattr(
        "app.service.plan.to_plan_item", Mock(return_value=SimpleNamespace(quiz=[]))
    )
    with pytest.raises(ForbiddenError, match="теста"):
        await service.submit_quiz(actor, uuid4(), [])


async def test_failed_chat_history_save_is_best_effort(caplog: pytest.LogCaptureFixture) -> None:
    db = SimpleNamespace(unit_of_work=Mock(side_effect=RuntimeError("DB offline")))
    service = ChatService(SimpleNamespace(db=db))
    turn = SimpleNamespace(texts=["partial"], parts=[])
    await service._save_failure(uuid4(), turn, "test failure")
    assert "could not save a failed turn" in caplog.text
    assert _last_user_text([]) == ""
    assert _last_user_text([ModelRequest(parts=[UserPromptPart("first")])]) == "first"


async def test_locked_conversation_lookup_does_not_reveal_a_strangers_id() -> None:
    from app.domain.assistant import ConversationNotFoundError  # noqa: PLC0415

    actor = CurrentUser(uuid4(), Role.INTERN, uuid4())
    uow = SimpleNamespace(assistant=SimpleNamespace(conversation=AsyncMock(return_value=None)))
    with pytest.raises(ConversationNotFoundError):
        await _conversation_locked(uow, actor, uuid4())


def test_unassigned_sensitive_question_and_lead_visibility() -> None:
    with pytest.raises(NoAssigneeError):
        first_assignment(EscalationKind.SENSITIVE, Chain(None, None, None))
    actor = CurrentUser(uuid4(), Role.LEAD, uuid4())
    member = SimpleNamespace(id=uuid4(), lead_id=actor.id, mentor_id=None, hrbp_id=None)
    assert can_view_member(actor, member)


async def test_auth_rate_limit_rejection_is_a_domain_error(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api import deps  # noqa: PLC0415
    from app.core.errors import RateLimitedError  # noqa: PLC0415
    from tests.conftest import build_settings  # noqa: PLC0415

    monkeypatch.setattr(deps.RateLimiter, "hit", AsyncMock(return_value=False))
    request = SimpleNamespace(client=None)
    with pytest.raises(RateLimitedError):
        await deps.rate_limit("login")(request, object(), build_settings(rate_limit_enabled=True))


async def test_escalation_missing_or_unauthorized_records_are_hidden() -> None:
    from app.domain.escalations import EscalationNotFoundError  # noqa: PLC0415
    from app.domain.knowledge import ConflictNotFoundError  # noqa: PLC0415

    actor = CurrentUser(uuid4(), Role.INTERN, uuid4())
    uow = SimpleNamespace(
        escalations=SimpleNamespace(get=AsyncMock(return_value=None)),
        knowledge=SimpleNamespace(conflict=AsyncMock(return_value=None)),
    )
    service = EscalationService(uow, sla_hours=24)
    with pytest.raises(ConflictNotFoundError):
        await service.report_conflict(actor, uuid4())
    uow.knowledge.conflict.return_value = SimpleNamespace(
        company_chunk_id=uuid4(), team_chunk_id=uuid4()
    )
    uow.knowledge.chunk_rows = AsyncMock(return_value={})
    with pytest.raises(ConflictNotFoundError):
        await service.report_conflict(actor, uuid4())
    for call in (
        service.get(actor, uuid4()),
        service.close(actor, uuid4()),
        service.answer(actor, uuid4(), answer="Test", publish_to_faq=False, knowledge=Mock()),
    ):
        with pytest.raises(EscalationNotFoundError):
            await call
    uow.escalations.get.return_value = SimpleNamespace(user_id=actor.id, assignee_id=uuid4())
    with pytest.raises(ForbiddenError):
        await service.answer(actor, uuid4(), answer="Test", publish_to_faq=False, knowledge=Mock())


async def test_cors_preflight_is_enabled_only_for_configured_origin() -> None:
    from httpx import ASGITransport, AsyncClient  # noqa: PLC0415

    from app.main import create_app  # noqa: PLC0415
    from tests.conftest import build_settings  # noqa: PLC0415

    app = create_app(build_settings(cors_allow_origins="https://portal.buddy.test"))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.options(
            "/api/v1/me",
            headers={
                "Origin": "https://portal.buddy.test",
                "Access-Control-Request-Method": "GET",
            },
        )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "https://portal.buddy.test"


async def test_review_route_rejects_item_owned_by_a_different_mentee() -> None:
    from app.api.schemas.plan import ReviewIn  # noqa: PLC0415
    from app.api.v1.people_ops import review  # noqa: PLC0415
    from app.core.errors import NotFoundError  # noqa: PLC0415

    with pytest.raises(NotFoundError):
        await review(
            uuid4(),
            uuid4(),
            ReviewIn(transition="approve"),
            object(),
            SimpleNamespace(mentee=AsyncMock()),
            SimpleNamespace(transition=AsyncMock(return_value=SimpleNamespace(user_id=uuid4()))),
        )
