"""Regression and boundary scenarios against the migrated PostgreSQL database."""

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy import select

from app.core.clock import today
from app.db.models import KbConflict
from app.domain.escalations import EscalationKind
from app.domain.knowledge import DocKind, DocScope
from app.domain.users import CurrentUser
from app.service.assistant import tools
from app.service.assistant.deps import AgentDeps
from app.service.escalations import EscalationService
from app.service.knowledge import KnowledgeService, viewer_of
from app.service.people import PeopleService
from tests.fakes import FakeGenerator
from tests.integration.conftest import Account


async def context(app: FastAPI, account: Account, *, approved: bool = False):
    async with app.state.db.unit_of_work() as uow:
        person = await PeopleService(uow).person(UUID(account.id))
    actor = CurrentUser(
        UUID(account.id), person.role, uuid4(), person.team.id if person.team else None
    )
    deps = AgentDeps(
        actor=actor,
        person=person,
        db=app.state.db,
        corp=app.state.corp,
        embeddings=None,
        settings=app.state.settings,
        conversation_id=uuid4(),
        today=today(),
        stage_title="Первая неделя",
        next_steps=[],
    )
    return SimpleNamespace(deps=deps, tool_call_approved=approved, tool_call_id=uuid4().hex)


async def test_vector_database_failure_preserves_full_text_search(
    app: FastAPI,
    anya: Account,
) -> None:
    ctx = await context(app, anya)
    embedder = SimpleNamespace(embed_query=AsyncMock(return_value=[float("nan")] * 1024))
    async with app.state.db.unit_of_work() as uow:
        result = await KnowledgeService(uow, embedder).search(
            viewer_of(ctx.deps.actor),
            "ноутбук",
            user_id=ctx.deps.actor.id,
        )
        await uow.flush()
    assert result.mode == "fts"
    assert result.hits
    assert all(hit.document_slug != "mentor-guide" for hit in result.hits)


async def test_conflict_detection_checks_every_team_and_is_repeatable(
    app: FastAPI,
    anya: Account,
) -> None:
    ctx = await context(app, anya)
    async with app.state.db.unit_of_work() as uow:
        service = KnowledgeService(uow, None)
        for slug, scope, team in [
            ("test-company", DocScope.COMPANY, None),
            ("test-listings", DocScope.TEAM, ctx.deps.actor.team_id),
            ("test-other-team", DocScope.TEAM, None),
        ]:
            await service.ingest(
                slug=slug,
                title=slug,
                kind=DocKind.GUIDE,
                scope=scope,
                team_id=team,
                roles=[],
                owner="Synthetic owner",
                source_label="Тестовая инструкция",
                source_url=None,
                updated_at=today(),
                body="## Правило\n<!-- topic: test.rules -->\nПравило для теста.",
            )
        generator = FakeGenerator("ДА\nТестовые правила расходятся.")
        assert await service.detect_conflicts(generator, ["test.rules"]) == 2
        assert await service.detect_conflicts(generator, ["test.rules"]) == 0
        rows = (
            await uow.session.scalars(select(KbConflict).where(KbConflict.topic == "test.rules"))
        ).all()
        assert len(rows) == 2
        assert len(generator.prompts) == 2


async def test_private_question_is_refused_before_card_or_notification(
    app: FastAPI,
    anya: Account,
) -> None:
    for approved in (False, True):
        ctx = await context(app, anya, approved=approved)
        output = await tools.ask_mentor(ctx, "Какая зарплата у коллеги?", "sensitive")
        assert "не передаю" in output["message"]
        assert not ctx.deps.parts
    async with app.state.db.unit_of_work() as uow:
        assert await EscalationService(uow, sla_hours=24).mine(ctx.deps.actor) == []


async def test_faq_answer_tool_checks_assignee_and_publishes_only_after_approval(
    app: FastAPI,
    anya: Account,
    ivan: Account,
) -> None:
    ctx = await context(app, anya)
    async with app.state.db.unit_of_work() as uow:
        question = await EscalationService(uow, sla_hours=24).create(
            ctx.deps.actor,
            question="Как устроен тестовый процесс?",
            kind=EscalationKind.QUESTION,
        )
    mentor = await context(app, ivan)
    from pydantic_ai import ApprovalRequired  # noqa: PLC0415

    with pytest.raises(ApprovalRequired) as card:
        await tools.answer_question(mentor, question.id, "Тестовый ответ", True)
    assert card.value.metadata["args"]["question_id"] == str(question.id)
    mentor.tool_call_approved = True
    output = await tools.answer_question(mentor, question.id, "Тестовый ответ", True)
    assert "FAQ" in output["message"]
    again = await tools.answer_question(mentor, question.id, "Повтор", True)
    assert "уже ответили" in again["message"]
    async with app.state.db.unit_of_work() as uow:
        document = await uow.knowledge.document_by_slug(f"faq-{question.id.hex[:12]}")
        assert document is not None
        assert "Тестовый ответ" in document.body


async def test_missing_people_and_plan_records_fail_closed(app: FastAPI, anya: Account) -> None:
    from app.domain.plan import PlanItemNotFoundError  # noqa: PLC0415
    from app.domain.users import UserNotFoundError  # noqa: PLC0415
    from app.service.plan import PlanService  # noqa: PLC0415

    ctx = await context(app, anya)
    missing = uuid4()
    async with app.state.db.unit_of_work() as uow:
        people, plan = PeopleService(uow), PlanService(uow)
        for call in (
            people.person(missing),
            people.member(ctx.deps.actor, missing),
            plan.overview(missing),
        ):
            with pytest.raises(UserNotFoundError):
                await call
        with pytest.raises(PlanItemNotFoundError):
            await plan.item(ctx.deps.actor, missing)
        assert await plan.link_request(missing, uuid4()) is None
        assert await plan.complete_by_system(missing, note="test") is None
        assert await plan.request_resolved(missing, approved=False) is None
        assert await uow.plan.items_for_users([]) == []
        assert await uow.plan.template_by_slug("missing") is None
        assert (
            await uow.plan.find_by_template_slug(ctx.deps.actor.id, "missing", for_update=True)
            is None
        )
        assert await uow.people.get_many([]) == {}
        assert await uow.people.team(None) is None
        assert await uow.people.teams([]) == {}
        assert await uow.people.teams([ctx.deps.actor.team_id])
        assert await uow.escalations.open_for_users([]) == []
        assert await uow.requests.open_for_users([]) == []
        assert await uow.knowledge.full_text("?!", viewer_of(ctx.deps.actor), limit=5) == []
        assert await uow.knowledge.embedded_share() == (
            0,
            len(await uow.knowledge.chunks_without_embedding(limit=1000)),
        )
        assert await plan.instantiate(await people.user(ctx.deps.actor.id), start=today()) == 0


async def test_completed_plan_item_cannot_be_reopened_by_request_link(
    app: FastAPI, anya: Account
) -> None:
    from app.domain.plan import ItemStatus  # noqa: PLC0415
    from app.service.plan import PlanService  # noqa: PLC0415

    ctx = await context(app, anya)
    async with app.state.db.unit_of_work() as uow:
        item, _template = (await uow.plan.items(ctx.deps.actor.id))[0]
        item.status = ItemStatus.DONE
        await uow.flush()
        plan = PlanService(uow)
        await plan.link_request(item.id, uuid4())
        assert item.status is ItemStatus.DONE
        unchanged = await plan.request_resolved(item.id, approved=False)
        assert unchanged.status is ItemStatus.DONE
        assert item.request_id is None


async def test_access_approvers_are_selected_by_resource_policy(
    app: FastAPI, anya: Account
) -> None:
    from app.service.requests import RequestService  # noqa: PLC0415

    ctx = await context(app, anya)
    async with app.state.db.unit_of_work() as uow:
        service = RequestService(uow, app.state.corp, access_sla_hours=24)
        assert (
            "DevOps"
            in (
                await service.prepare_access(ctx.deps.actor, resource="k8s-listings-staging")
            ).approver
        )
        assert (
            "Владелец" in (await service.prepare_access(ctx.deps.actor, resource="redash")).approver
        )


async def test_notification_and_auth_error_contracts(client: AsyncClient, anya: Account) -> None:
    missing = await client.post(f"/api/v1/notifications/{uuid4()}/read", headers=anya.headers)
    assert missing.status_code == 404
    assert missing.json()["error_code"] == "NOT_FOUND"
    refresh = await client.post("/api/v1/auth/refresh")
    assert refresh.status_code == 401
    assert refresh.json()["error_code"] == "NOT_AUTHENTICATED"
    web = await client.post(
        "/api/v1/auth/login", json={"email": anya.email, "password": "orbi-demo-2026"}
    )
    denied = await client.post("/api/v1/auth/refresh", headers={"X-CSRF-Token": "wrong"})
    assert denied.status_code == 403
    assert denied.json()["error_code"] == "CSRF_FAILED"
    assert web.status_code == 200
    refreshed = await client.post(
        "/api/v1/auth/refresh", headers={"X-CSRF-Token": client.cookies["csrf_token"]}
    )
    assert refreshed.status_code == 200
    assert refreshed.json()["refresh_token"] is None
    client.cookies.clear()
    client.cookies.set("refresh_token", "not-a-refresh-token")
    invalid = await client.post("/api/v1/auth/refresh")
    assert invalid.status_code == 401
    assert len(invalid.headers.get_list("set-cookie")) == 2


async def test_tools_expose_useful_recoverable_failure_messages(
    app: FastAPI, anya: Account
) -> None:
    from datetime import timedelta  # noqa: PLC0415

    from app.domain.absence import AbsenceType  # noqa: PLC0415
    from app.domain.requests import AccessLevel  # noqa: PLC0415

    ctx = await context(app, anya)
    assert (await tools.find_access_resources(ctx, "несуществующий ресурс"))["resources"] == []
    assert (await tools.find_access_resources(ctx, "stash-listings-api"))["resources"]
    assert (await tools.request_access(ctx, "stash-listings-api", AccessLevel.ADMIN))[
        "error"
    ] == "ACCESS_LEVEL_NOT_ALLOWED"
    assert (await tools.request_access(ctx, "репозиторий"))["outcome"] == "ambiguous"
    assert (await tools.request_access(ctx, "missing"))["outcome"] == "not_found"
    assert not await tools._close_access_step(ctx, "not-in-plan")
    assert (await tools.update_plan_step(ctx, "несуществующий шаг", "complete"))[
        "message"
    ].startswith("Не нашёл")
    assert (await tools.search_knowledge(ctx, "Какая зарплата у коллеги?"))["sources"] == []
    assert (await tools.search_knowledge(ctx, "выгорание и конфликт с наставником"))[
        "sensitive"
    ] == "conflict"
    monday = today() + timedelta(days=(7 - today().weekday()) % 7)
    check = await tools.check_absence(ctx, AbsenceType.DAY_OFF, monday, monday)
    assert check["working_days"] == 1
    assert check["warnings"]
    invalid = await tools.check_absence(
        ctx, AbsenceType.DAY_OFF, today() - timedelta(days=1), today()
    )
    assert invalid["error"] == "ABSENCE_INVALID_DATES"
    invalid = await tools.request_absence(
        ctx, AbsenceType.DAY_OFF, today() - timedelta(days=1), today()
    )
    assert invalid["error"] == "ABSENCE_INVALID_DATES"
    app.state.corp.unavailable = True
    assert (await tools.absence_balance(ctx))["error"] == "unavailable"
    assert (await tools.equipment_status(ctx))["error"] == "unavailable"


async def test_equipment_empty_ready_and_late_have_next_steps(app: FastAPI, anya: Account) -> None:
    from app.domain.corp import EquipmentStatus  # noqa: PLC0415
    from tests.fakes import laptop  # noqa: PLC0415

    ctx = await context(app, anya)
    app.state.corp.equipment_items[anya.email] = []
    assert (await tools.equipment_status(ctx))["items"] == []
    app.state.corp.equipment_items[anya.email] = [laptop(EquipmentStatus.READY_FOR_PICKUP)]
    assert "забрать" in (await tools.equipment_status(ctx))["message"]
    app.state.corp.equipment_items[anya.email] = [laptop(EquipmentStatus.DELAYED, eta_days=-1)]
    assert "Срок прошёл" in (await tools.equipment_status(ctx))["message"]


async def test_request_submission_refusal_and_retry_are_distinct(
    app: FastAPI, anya: Account
) -> None:
    from app.domain.corp import CorpTicketStatus  # noqa: PLC0415

    ctx = await context(app, anya, approved=True)
    app.state.corp.unavailable = True
    result = await tools.request_access(ctx, "stash-listings-api")
    assert result["request"]["status"] == "submitting"
    assert "сохранил" in result["message"]
    app.state.corp.unavailable = False
    result = await tools.request_access(await context(app, anya), "stash-listings-api")
    assert result["outcome"] == "pending_exists"
    app.state.corp.refuse_with = "Synthetic refusal"
    ctx.tool_call_id = uuid4().hex
    result = await tools.create_it_ticket(ctx, "Test", "Synthetic test")
    assert result["request"]["status"] == "failed"
    assert "отказал" in result["message"]
    app.state.corp.refuse_with = None
    app.state.corp.auto_decision = CorpTicketStatus.APPROVED
    ctx.tool_call_id = uuid4().hex
    result = await tools.create_it_ticket(ctx, "Test", "Synthetic test")
    assert result["request"]["status"] == "approved"
    assert "одобрена" in result["message"]


async def test_employee_without_contacts_has_no_delivery_target(
    app: FastAPI, anya: Account
) -> None:

    async with app.state.db.unit_of_work() as uow:
        user = await uow.people.get(UUID(anya.id))
        user.team_id = user.mentor_id = user.lead_id = user.hrbp_id = None
    ctx = await context(app, anya)
    assert "не указан канал" in (await tools.post_team_message(ctx, "Test"))["message"]
    assert "некому передать" in (await tools.ask_mentor(ctx, "Test question"))["message"]
    assert "не заполнены" in (await tools.who_is_who(ctx))["message"]


async def test_mentor_without_assignments_has_empty_tool_results(
    app: FastAPI, admin: Account
) -> None:
    ctx = await context(app, admin)
    # An admin can inspect all interns, but no questions are assigned to this account.
    assert (await tools.open_questions(ctx))["questions"] == []
    from dataclasses import replace  # noqa: PLC0415

    from app.domain.users import Role  # noqa: PLC0415

    ctx.deps.actor = replace(ctx.deps.actor, role=Role.MENTOR)
    assert (await tools.list_mentees(ctx))["mentees"] == []


async def test_deciding_one_card_expires_siblings_and_unknown_card_is_404(
    app: FastAPI,
    anya: Account,
) -> None:
    from datetime import timedelta  # noqa: PLC0415

    from app.core.clock import utcnow  # noqa: PLC0415
    from app.db.models import PendingAction  # noqa: PLC0415
    from app.domain.assistant import ActionNotFoundError, ActionStatus, Decision  # noqa: PLC0415
    from app.service.assistant.chat import ChatService  # noqa: PLC0415

    actor = (await context(app, anya)).deps.actor
    chat = ChatService(app.state.chat)
    conversation = await chat.create(actor)
    ids = []
    async with app.state.db.unit_of_work() as uow:
        for _ in range(2):
            action = PendingAction(
                conversation_id=conversation.id,
                user_id=actor.id,
                tool_call_id=uuid4().hex,
                tool_name="post_team_message",
                args={"text": "Synthetic message"},
                card={},
                expires_at=utcnow() + timedelta(minutes=5),
            )
            uow.assistant.add_action(action)
            await uow.flush()
            ids.append(action.id)
    decision = await chat.prepare_decision(
        actor, conversation.id, ids[0], decision=Decision.REJECT, edits={}
    )
    assert len(decision.approvals) == 2
    async with app.state.db.unit_of_work() as uow:
        assert (await uow.session.get(PendingAction, ids[0])).status is ActionStatus.REJECTED
        assert (await uow.session.get(PendingAction, ids[1])).status is ActionStatus.EXPIRED
    with pytest.raises(ActionNotFoundError):
        await chat.prepare_decision(
            actor, conversation.id, uuid4(), decision=Decision.APPROVE, edits={}
        )


async def test_index_completion_and_conflict_visibility(app: FastAPI, anya: Account) -> None:
    from app.db.repositories.knowledge import Viewer  # noqa: PLC0415
    from app.domain.knowledge import ConflictStatus  # noqa: PLC0415
    from app.domain.users import Role  # noqa: PLC0415
    from tests.fakes import FakeEmbeddings  # noqa: PLC0415

    actor = (await context(app, anya)).deps.actor
    async with app.state.db.unit_of_work() as uow:
        service = KnowledgeService(uow, FakeEmbeddings())
        await service.embed_pending(limit=1000)
        assert await service.embed_pending() == 0
        assert await service.register_conflict(topic="missing", summary="Test") is None
        assert await uow.people.team_by_slug("listings") is not None
        admin = await service.search(Viewer(Role.ADMIN, None), "платёжные токены")
        assert any(hit.document_slug == "team-payments-handbook" for hit in admin.hits)
        conflict = (await uow.session.scalars(select(KbConflict))).first()
        conflict.status = ConflictStatus.RESOLVED
        assert await service._conflicts(viewer_of(actor), [conflict.company_chunk_id]) == []
        conflict.status = ConflictStatus.OPEN
        pair = await uow.knowledge.chunk_rows([conflict.team_chunk_id])
        pair[conflict.team_chunk_id].document.roles = ["mentor"]
        await uow.flush()
        assert await service._conflicts(viewer_of(actor), [conflict.company_chunk_id]) == []


async def test_requests_ignore_late_decisions_and_reject_unknown_reminders(
    app: FastAPI,
    anya: Account,
) -> None:
    from app.domain.corp import CorpTicketStatus  # noqa: PLC0415
    from app.domain.requests import RequestNotFoundError, RequestSource, RequestStatus  # noqa: PLC0415
    from app.service.requests import RequestService  # noqa: PLC0415

    ctx = await context(app, anya, approved=True)
    assert (await tools.request_access(ctx, "missing"))["outcome"] == "not_found"
    app.state.corp.auto_decision = CorpTicketStatus.APPROVED
    result = await tools.create_it_ticket(ctx, "Test", "Synthetic test")
    async with app.state.db.unit_of_work() as uow:
        service = RequestService(uow, app.state.corp, access_sla_hours=24)
        with pytest.raises(RequestNotFoundError):
            await service.remind(ctx.deps.actor, uuid4())
        row = await uow.requests.get(UUID(result["request"]["id"]))
        await service.mark_failed(row, "Late failure")
        view = await service.apply_decision(
            external_id=row.external_id,
            status=CorpTicketStatus.REJECTED,
            comment="Late rejection",
            source=RequestSource.WORKER,
        )
        assert view.status is RequestStatus.APPROVED


async def test_external_number_collision_invalidates_both_open_requests(
    app: FastAPI,
    anya: Account,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.domain.corp import CorpTicket, CorpTicketStatus  # noqa: PLC0415

    first = await tools.request_access(
        await context(app, anya, approved=True), "stash-listings-api"
    )
    monkeypatch.setattr(
        app.state.corp,
        "access_create",
        AsyncMock(
            return_value=CorpTicket(
                first["request"]["external_id"],
                CorpTicketStatus.PENDING_APPROVAL,
            )
        ),
    )
    second = await tools.request_access(
        await context(app, anya, approved=True), "k8s-listings-staging"
    )
    assert second["request"]["status"] == "failed"
    async with app.state.db.unit_of_work() as uow:
        row = await uow.requests.get(UUID(first["request"]["id"]))
        assert row.status.value == "failed"
        assert "повторно" in row.decision_comment


async def test_sla_nudge_never_promises_unsupported_absence_reminder(
    app: FastAPI,
    anya: Account,
) -> None:
    from datetime import timedelta  # noqa: PLC0415

    from app.core.clock import utcnow  # noqa: PLC0415
    from app.db.models import ServiceRequest  # noqa: PLC0415
    from app.domain.requests import RequestKind, RequestStatus  # noqa: PLC0415
    from app.service.nudges import Nudges  # noqa: PLC0415

    async with app.state.db.unit_of_work() as uow:
        row = ServiceRequest(
            user_id=UUID(anya.id),
            kind=RequestKind.ABSENCE,
            status=RequestStatus.SUBMITTED,
            title="Тестовый отгул",
            payload={},
            external_id="ABS-test",
            idempotency_key="sla-absence",
            sla_due_at=utcnow() - timedelta(hours=1),
        )
        uow.requests.add(row)
        await uow.flush()
        request_id = row.id
    sent = await Nudges(app.state.db, app.state.corp, app.state.settings).requests_past_sla()
    assert sent >= 1
    async with app.state.db.unit_of_work() as uow:
        notes = await uow.notifications.for_user(UUID(anya.id), unread_only=False, limit=100)
        note = next(note for note in notes if note.payload.get("request_id") == str(request_id))
        assert note.payload.get("action") != "remind"
        assert "напомнить" not in note.body
