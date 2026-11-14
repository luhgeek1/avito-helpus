import asyncio
import json
import time
from collections.abc import Awaitable, Callable
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.api.v1.people_ops import events
from app.core.clock import today
from app.core.config import Settings
from app.core.security import webhooks
from app.core.security.tokens import TokenCodec
from app.db.database import Database
from app.db.models import KbChunk, KbConflict, KbDocument, OutboxEvent, ServiceRequest
from app.domain.corp import CorpEvent, CorpTicketStatus
from app.domain.events import OutboxStatus, Topic
from app.domain.requests import RequestSource, RequestStatus, Sensitivity
from app.domain.users import CurrentUser, MenteeNotFoundError, Role
from app.service.nudges import Nudges
from app.service.requests import RequestService, fail_control
from tests.fakes import FakeCorpServices
from tests.integration.conftest import Account

Outbox = Callable[[], Awaitable[int]]


async def create_access(client: AsyncClient, account: Account, key: str) -> dict:
    response = await client.post(
        "/api/v1/requests/access",
        headers=account.headers,
        json={"resource": "stash-listings-api", "idempotency_key": key},
    )
    assert response.status_code == 201, response.text
    return response.json()


async def test_external_id_collision_fails_once_with_explanation(
    client: AsyncClient,
    anya: Account,
    kirill: Account,
    db: Database,
    run_outbox: Outbox,
) -> None:
    async with db.unit_of_work() as uow:
        old = (await uow.requests.for_user(UUID(kirill.id)))[0]
        old.external_id = "ACC-1042"
    created = await create_access(client, anya, "collision-key")
    await run_outbox()
    response = await client.get(
        f"/api/v1/requests/{created['request']['id']}",
        headers=anya.headers,
    )
    assert response.json()["status"] == "failed"
    assert response.json()["external_id"] is None
    assert "номер" in response.json()["decision_comment"]
    notes = (await client.get("/api/v1/notifications", headers=anya.headers)).json()["items"]
    assert "номер" in notes[0]["body"]
    async with db.unit_of_work() as uow:
        event = await uow.session.scalar(
            select(OutboxEvent).where(
                OutboxEvent.topic == Topic.REQUEST_SUBMIT,
            )
        )
        assert event.status is OutboxStatus.DONE
        assert event.attempts == 1


async def test_parallel_creation_is_idempotent(client: AsyncClient, anya: Account) -> None:
    results = await asyncio.gather(*(create_access(client, anya, "parallel-key") for _ in range(3)))
    assert len({r["request"]["id"] for r in results}) == 1


async def test_key_cannot_be_reused_for_another_request_kind(
    client: AsyncClient,
    anya: Account,
) -> None:
    await create_access(client, anya, "shared-key-1")
    response = await client.post(
        "/api/v1/requests/it-ticket",
        headers=anya.headers,
        json={
            "category": "Ноутбук",
            "description": "Не включается",
            "idempotency_key": "shared-key-1",
        },
    )
    assert response.status_code == 409


async def test_mentor_cannot_read_sensitive_questions(
    client: AsyncClient,
    anya: Account,
    ivan: Account,
    maria: Account,
    olga: Account,
) -> None:
    private = await client.post(
        "/api/v1/escalations",
        headers=anya.headers,
        json={"question": "Конфликт с наставником, нужна помощь HRBP", "kind": "sensitive"},
    )
    question_id = private.json()["id"]
    for account in (ivan, maria):
        detail = (await client.get(f"/api/v1/mentees/{anya.id}", headers=account.headers)).json()
        assert question_id not in {q["id"] for q in detail["questions"]}
    hr_detail = (await client.get(f"/api/v1/mentees/{anya.id}", headers=olga.headers)).json()
    assert question_id in {q["id"] for q in hr_detail["questions"]}


@pytest.mark.parametrize("body", [b"{", b"{}", b'{"event":"wrong"}'])
async def test_signed_invalid_webhook_returns_problem(
    client: AsyncClient,
    settings: Settings,
    body: bytes,
) -> None:
    timestamp = str(int(time.time()))
    response = await client.post(
        "/api/v1/integrations/corp/webhook",
        content=body,
        headers={
            "X-Corp-Timestamp": timestamp,
            "X-Corp-Signature": webhooks.sign(
                settings.corp_webhook_secret.get_secret_value(),
                timestamp,
                body,
            ),
        },
    )
    assert response.status_code == 422
    assert response.headers["content-type"] == "application/problem+json"


@pytest.mark.parametrize("change", ["ban", "resource_hidden", "level_revoked"])
async def test_queued_access_rechecks_current_permissions(
    client: AsyncClient,
    anya: Account,
    maria: Account,
    db: Database,
    run_outbox: Outbox,
    corp: FakeCorpServices,
    change: str,
) -> None:
    account = maria if change == "level_revoked" else anya
    created = (
        await client.post(
            "/api/v1/requests/access",
            headers=account.headers,
            json={
                "resource": "stash-listings-api",
                "idempotency_key": "permissions-change",
                "level": "admin" if change == "level_revoked" else "write",
            },
        )
    ).json()
    async with db.unit_of_work() as uow:
        if change == "resource_hidden":
            resource = await uow.requests.resource_by_slug("stash-listings-api")
            resource.sensitivity = Sensitivity.RESTRICTED
        else:
            user = await uow.people.get(UUID(account.id))
            if change == "ban":
                user.banned_at = datetime.now(UTC)
            else:
                user.role = Role.INTERN
    await run_outbox()
    async with db.unit_of_work() as uow:
        request = await uow.requests.get(UUID(created["request"]["id"]))
        assert request.status is RequestStatus.FAILED
    assert "access_create" not in corp.calls


async def test_cancel_verifies_ticket_identity_before_external_effect(
    client: AsyncClient,
    anya: Account,
    run_outbox: Outbox,
    corp: FakeCorpServices,
) -> None:
    created = await create_access(client, anya, "cancel-other-ticket")
    await run_outbox()
    corp.tickets["ACC-1042"] = replace(corp.tickets["ACC-1042"], idempotency_key="other-employee")
    await client.post(f"/api/v1/requests/{created['request']['id']}/cancel", headers=anya.headers)
    await run_outbox()
    assert "cancel_request" not in corp.calls
    saved = (
        await client.get(f"/api/v1/requests/{created['request']['id']}", headers=anya.headers)
    ).json()
    assert saved["status"] == "submitted"
    assert "cancel_requested" not in saved["payload"]
    assert "не подтвердил" in saved["decision_comment"]


async def test_wrong_service_webhook_does_not_change_request(
    client: AsyncClient,
    anya: Account,
    run_outbox: Outbox,
    settings: Settings,
) -> None:
    created = await create_access(client, anya, "wrong-service")
    await run_outbox()
    body = json.dumps(
        {
            "event": "request.status_changed",
            "service": "absence",
            "request_id": "ACC-1042",
            "status": "approved",
        }
    ).encode()
    timestamp = str(int(time.time()))
    response = await client.post(
        "/api/v1/integrations/corp/webhook",
        content=body,
        headers={
            "X-Corp-Timestamp": timestamp,
            "X-Corp-Signature": webhooks.sign(
                settings.corp_webhook_secret.get_secret_value(),
                timestamp,
                body,
            ),
        },
    )
    assert response.status_code == 200
    request = (
        await client.get(
            f"/api/v1/requests/{created['request']['id']}",
            headers=anya.headers,
        )
    ).json()
    assert request["status"] == "submitted"


async def test_refused_reconciliation_does_not_starve_other_requests(
    client: AsyncClient,
    anya: Account,
    db: Database,
    corp: FakeCorpServices,
    settings: Settings,
    run_outbox: Outbox,
) -> None:
    created = await create_access(client, anya, "missing-ticket")
    await run_outbox()
    corp.tickets.clear()
    async with db.unit_of_work() as uow:
        request = await uow.requests.get(UUID(created["request"]["id"]))
        request.updated_at = datetime(2020, 1, 1, tzinfo=UTC)
    assert await Nudges(db, corp, settings).reconcile() == 1
    async with db.unit_of_work() as uow:
        request = await uow.session.get(ServiceRequest, UUID(created["request"]["id"]))
        assert request.status is RequestStatus.FAILED


async def test_maximum_client_key_fits_the_user_namespace(
    client: AsyncClient, anya: Account
) -> None:
    created = await create_access(client, anya, "k" * 128)
    assert created["request"]["status"] == "submitting"


async def test_hidden_conflict_cannot_be_reported(
    client: AsyncClient, anya: Account, db: Database
) -> None:
    async with db.unit_of_work() as uow:
        conflict = await uow.session.scalar(select(KbConflict))
        chunk = await uow.session.get(KbChunk, conflict.team_chunk_id)
        document = await uow.session.get(KbDocument, chunk.document_id)
        document.roles = ["mentor"]
        conflict_id = conflict.id
    response = await client.post(
        f"/api/v1/knowledge/conflicts/{conflict_id}/report", headers=anya.headers, json={}
    )
    assert response.status_code == 404


async def test_cancellation_reaches_corporate_service(
    client: AsyncClient,
    anya: Account,
    run_outbox: Outbox,
    corp: FakeCorpServices,
) -> None:
    created = await create_access(client, anya, "cancel-remote")
    await run_outbox()
    response = await client.post(
        f"/api/v1/requests/{created['request']['id']}/cancel", headers=anya.headers
    )
    assert response.json()["status"] == "submitted"
    assert "cancel_request" not in corp.calls
    await run_outbox()
    assert corp.tickets["ACC-1042"].status.value == "cancelled"
    saved = (
        await client.get(f"/api/v1/requests/{created['request']['id']}", headers=anya.headers)
    ).json()
    assert saved["status"] == "cancelled"


async def test_approval_wins_if_cancel_arrives_too_late(
    client: AsyncClient,
    anya: Account,
    run_outbox: Outbox,
    corp: FakeCorpServices,
) -> None:
    created = await create_access(client, anya, "cancel-race-1")
    await run_outbox()
    corp.decide("ACC-1042", CorpTicketStatus.APPROVED, "Доступ уже выдан")
    await client.post(f"/api/v1/requests/{created['request']['id']}/cancel", headers=anya.headers)
    await run_outbox()
    saved = (
        await client.get(f"/api/v1/requests/{created['request']['id']}", headers=anya.headers)
    ).json()
    assert saved["status"] == "approved"


async def test_cancel_before_submission_never_reaches_service(
    client: AsyncClient,
    anya: Account,
    run_outbox: Outbox,
    corp: FakeCorpServices,
) -> None:
    created = await create_access(client, anya, "cancel-before-send")
    response = await client.post(
        f"/api/v1/requests/{created['request']['id']}/cancel", headers=anya.headers
    )
    assert response.json()["status"] == "cancelled"
    await run_outbox()
    assert "access_create" not in corp.calls


async def test_control_failure_notifies_and_allows_cancel_retry(
    client: AsyncClient,
    anya: Account,
    run_outbox: Outbox,
    corp: FakeCorpServices,
    db: Database,
) -> None:
    created = await create_access(client, anya, "cancel-outage")
    await run_outbox()
    path = f"/api/v1/requests/{created['request']['id']}"
    await client.post(path + "/cancel", headers=anya.headers)
    await client.post(path + "/cancel", headers=anya.headers)
    corp.unavailable = True
    await run_outbox()
    async with db.unit_of_work() as uow:
        event = await uow.session.scalar(
            select(OutboxEvent).where(OutboxEvent.topic == Topic.REQUEST_CANCEL)
        )
        event.available_at = datetime(2020, 1, 1, tzinfo=UTC)
    await run_outbox()
    saved = (await client.get(path, headers=anya.headers)).json()
    assert saved["status"] == "submitted"
    assert "cancel_requested" not in saved["payload"]
    notes = (await client.get("/api/v1/notifications", headers=anya.headers)).json()["items"]
    assert "не подтверждены" in notes[0]["body"]
    corp.unavailable = False
    await client.post(path + "/cancel", headers=anya.headers)
    await run_outbox()
    assert (await client.get(path, headers=anya.headers)).json()["status"] == "cancelled"
    await fail_control(db, UUID(created["request"]["id"]))  # terminal requests are preserved


async def test_two_workers_submit_only_once(
    client: AsyncClient,
    anya: Account,
    run_outbox: Outbox,
    corp: FakeCorpServices,
) -> None:
    await create_access(client, anya, "two-workers")
    await asyncio.gather(run_outbox(), run_outbox())
    assert corp.calls.count("access_create") == 1


async def test_service_list_cannot_read_a_strangers_requests(
    db: Database,
    anya: Account,
    dana: Account,
    corp: FakeCorpServices,
) -> None:
    async with db.unit_of_work() as uow:
        actor = CurrentUser(id=UUID(anya.id), role=Role.INTERN, session_id=UUID(anya.id))
        with pytest.raises(MenteeNotFoundError):
            await RequestService(uow, corp, access_sla_hours=24).requests(
                actor, user_id=UUID(dana.id)
            )


async def test_mismatched_service_result_fails_without_attaching_ticket(
    client: AsyncClient,
    anya: Account,
    run_outbox: Outbox,
    corp: FakeCorpServices,
) -> None:
    created = await create_access(client, anya, "mismatched-key")
    ticket = corp._ticket("ACC", f"web:{anya.id}:mismatched-key", "Approver")
    corp.tickets[ticket.external_id] = replace(ticket, idempotency_key="someone-elses-key")
    await run_outbox()
    saved = (
        await client.get(f"/api/v1/requests/{created['request']['id']}", headers=anya.headers)
    ).json()
    assert saved["status"] == "failed"
    assert saved["external_id"] is None


async def test_reconciliation_rejects_a_reused_tickets_key(
    client: AsyncClient,
    anya: Account,
    run_outbox: Outbox,
    corp: FakeCorpServices,
    db: Database,
    settings: Settings,
) -> None:
    created = await create_access(client, anya, "reconcile-wrong-key")
    await run_outbox()
    corp.tickets["ACC-1042"] = replace(corp.tickets["ACC-1042"], idempotency_key="wrong-key")
    async with db.unit_of_work() as uow:
        request = await uow.requests.get(UUID(created["request"]["id"]))
        request.updated_at = datetime(2020, 1, 1, tzinfo=UTC)
    assert await Nudges(db, corp, settings).reconcile() == 1
    saved = (
        await client.get(f"/api/v1/requests/{created['request']['id']}", headers=anya.headers)
    ).json()
    assert saved["status"] == "failed"


async def test_stale_ticket_does_not_complete_the_new_linked_plan_step(
    client: AsyncClient,
    anya: Account,
    db: Database,
    corp: FakeCorpServices,
    run_outbox: Outbox,
    settings: Settings,
) -> None:
    async def create(key: str) -> dict:
        return (
            await client.post(
                "/api/v1/requests/it-ticket",
                headers=anya.headers,
                json={
                    "category": "Ноутбук",
                    "description": "Не включается",
                    "idempotency_key": key,
                },
            )
        ).json()

    first = await create("old-ticket")
    second = await create("new-ticket")
    again = await create("new-ticket")
    assert again["id"] == second["id"]
    await run_outbox()
    async with db.unit_of_work() as uow:
        old = await uow.requests.get(UUID(first["id"]))
        await RequestService(uow, corp, access_sla_hours=24).apply_decision(
            external_id=old.external_id,
            status=CorpTicketStatus.APPROVED,
            comment="ok",
            source=RequestSource.WEBHOOK,
        )
        item, _ = await uow.plan.get(UUID(second["plan_item_id"]))
        assert item.status.value == "waiting"
        assert str(item.request_id) == second["id"]


async def test_absence_checks_moscow_calendar_and_limits_range(
    client: AsyncClient,
    anya: Account,
    corp: FakeCorpServices,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    day = today() + timedelta(days=1)
    while day.weekday() >= 5:
        day += timedelta(days=1)
    previous = day - timedelta(days=1)
    event = CorpEvent(
        "Важная встреча",
        datetime(previous.year, previous.month, previous.day, 22, tzinfo=UTC),
        True,
    )
    monkeypatch.setattr(corp, "calendar_events", AsyncMock(return_value=[event]))
    body = {"type": "day_off", "start_date": day.isoformat(), "end_date": day.isoformat()}
    checked = (
        await client.post("/api/v1/requests/absence/check", headers=anya.headers, json=body)
    ).json()
    assert "01:00" in checked["warnings"][-1]
    assert checked["conflicts"][0]["starts_at"].endswith("+03:00")
    first = await client.post(
        "/api/v1/requests/absence",
        headers=anya.headers,
        json={**body, "idempotency_key": "absence-retry"},
    )
    again = await client.post(
        "/api/v1/requests/absence",
        headers=anya.headers,
        json={**body, "idempotency_key": "absence-retry"},
    )
    assert first.json()["id"] == again.json()["id"]
    invalid = await client.post(
        "/api/v1/requests/absence/check",
        headers=anya.headers,
        json={**body, "end_date": "9999-12-31"},
    )
    assert invalid.status_code == 422


async def test_sse_stops_after_logout_everywhere(
    client: AsyncClient,
    anya: Account,
    db: Database,
    settings: Settings,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def idle(*args):
        await asyncio.sleep(60)
        yield {}

    monkeypatch.setattr("app.api.v1.people_ops.subscribe", idle)
    request = SimpleNamespace(
        headers={"authorization": anya.headers["Authorization"]},
        is_disconnected=AsyncMock(return_value=False),
    )
    actor = CurrentUser(id=UUID(anya.id), role=Role.INTERN, session_id=UUID(anya.id))
    response = await events(request, actor, None, db, TokenCodec.from_settings(settings))
    stream = response.body_iterator
    assert await anext(stream) == "retry: 3000\n\n"
    await client.post("/api/v1/auth/logout-all", headers=anya.headers)
    assert "auth.required" in await anext(stream)
    with pytest.raises(StopAsyncIteration):
        await anext(stream)


async def test_block_reason_above_database_limit_is_validation_error(
    client: AsyncClient, anya: Account
) -> None:
    plan = (await client.get("/api/v1/plan", headers=anya.headers)).json()
    item = plan["next_steps"][0]
    response = await client.post(
        f"/api/v1/plan/items/{item['id']}/transitions",
        headers=anya.headers,
        json={"transition": "block", "comment": "x" * 501},
    )
    assert response.status_code == 422
