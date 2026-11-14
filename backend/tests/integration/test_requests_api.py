import json
import time
from collections.abc import Awaitable, Callable
from datetime import timedelta
from typing import Any

from httpx import AsyncClient
from sqlalchemy import update

from app.core.clock import today
from app.core.config import Settings
from app.core.security import webhooks
from app.db.database import Database
from app.db.models import OutboxEvent, ServiceRequest
from app.domain.corp import CorpTicketStatus, EquipmentStatus
from app.service.nudges import Nudges
from tests.fakes import FakeCorpServices, laptop, meeting
from tests.integration.conftest import ANYA, Account

Outbox = Callable[[], Awaitable[int]]


async def _create_access(client: AsyncClient, account: Account, **body: Any) -> dict[str, Any]:
    payload = {"resource": "stash-listings-api", "idempotency_key": "card-0001", **body}
    response = await client.post("/api/v1/requests/access", json=payload, headers=account.headers)
    assert response.status_code == 201, response.text
    result: dict[str, Any] = response.json()
    return result


async def _webhook(client: AsyncClient, settings: Settings, **body: Any) -> int:
    raw = json.dumps({"event": "request.status_changed", "service": "access", **body}).encode()
    timestamp = str(int(time.time()))
    signature = webhooks.sign(settings.corp_webhook_secret.get_secret_value(), timestamp, raw)
    response = await client.post(
        "/api/v1/integrations/corp/webhook",
        content=raw,
        headers={
            "X-Corp-Timestamp": timestamp,
            "X-Corp-Signature": signature,
            "Content-Type": "application/json",
        },
    )
    return response.status_code


async def test_catalog_follows_abac(client: AsyncClient, anya: Account, olga: Account) -> None:
    intern = {
        r["slug"]
        for r in (await client.get("/api/v1/access/resources", headers=anya.headers)).json()
    }
    hrbp = {
        r["slug"]
        for r in (await client.get("/api/v1/access/resources", headers=olga.headers)).json()
    }

    assert "stash-listings-api" in intern
    assert not intern & {
        "prod-db-listings",
        "vault-secrets",
        "hr-compensation-report",
        "stash-payments-core",
    }
    assert "hr-compensation-report" in hrbp


async def test_preview_outcomes(client: AsyncClient, anya: Account) -> None:
    async def preview(**body: Any) -> dict[str, Any]:
        response = await client.post(
            "/api/v1/requests/access/preview", json=body, headers=anya.headers
        )
        result: dict[str, Any] = response.json()
        return result

    ready = await preview(resource="listings-api")
    granted = await preview(resource="jira-listings")
    hidden = await preview(resource="продовая база")
    ambiguous = await preview(resource="репозиторий")
    admin = await client.post(
        "/api/v1/requests/access/preview",
        json={"resource": "listings-api", "level": "admin"},
        headers=anya.headers,
    )

    assert ready["outcome"] == "ready"
    assert ready["level"] == "write"
    assert ready["approver"] == "Мария Ким, руководитель команды"
    assert ready["card"]["fields"][1]["editable"] is True
    assert granted["outcome"] == "already_granted"
    assert hidden["outcome"] == "not_found"
    assert ambiguous["outcome"] == "ambiguous"
    assert admin.status_code == 403
    assert admin.json()["error_code"] == "ACCESS_LEVEL_NOT_ALLOWED"


async def test_access_request_end_to_end(
    client: AsyncClient,
    anya: Account,
    corp: FakeCorpServices,
    run_outbox: Outbox,
    settings: Settings,
) -> None:
    created = await _create_access(client, anya, justification="Задача LST-1432: валидация цены")
    again = await _create_access(client, anya)
    assert created["outcome"] == "ready"
    assert again["request"]["id"] == created["request"]["id"]
    assert created["request"]["status"] == "submitting"
    assert "access_create" not in corp.calls  # nothing is sent inside the request transaction

    assert await run_outbox() >= 1
    request = (
        await client.get(f"/api/v1/requests/{created['request']['id']}", headers=anya.headers)
    ).json()
    assert request["status"] == "submitted"
    assert request["external_id"] == "ACC-1042"
    plan = (await client.get("/api/v1/plan", headers=anya.headers)).json()
    stash = next(i for s in plan["stages"] for i in s["items"] if i["slug"] == "access-stash")
    assert stash["status"] == "waiting"

    duplicate = (
        await client.post(
            "/api/v1/requests/access/preview",
            json={"resource": "listings-api"},
            headers=anya.headers,
        )
    ).json()
    assert duplicate["outcome"] == "pending_exists"

    assert (
        await _webhook(
            client, settings, request_id="ACC-1042", status="approved", comment="Доступ выдан"
        )
        == 200
    )
    assert (
        await _webhook(client, settings, request_id="ACC-1042", status="approved") == 200
    )  # replay is a no-op

    request = (
        await client.get(f"/api/v1/requests/{created['request']['id']}", headers=anya.headers)
    ).json()
    assert request["status"] == "approved"
    assert [h["status"] for h in request["history"]] == ["submitting", "submitted", "approved"]
    plan = (await client.get("/api/v1/plan", headers=anya.headers)).json()
    stash = next(i for s in plan["stages"] for i in s["items"] if i["slug"] == "access-stash")
    assert stash["status"] == "done"
    notes = (await client.get("/api/v1/notifications", headers=anya.headers)).json()["items"]
    assert "Следующий шаг" in notes[0]["body"]


async def test_rejection_reopens_the_step(
    client: AsyncClient, anya: Account, run_outbox: Outbox, settings: Settings
) -> None:
    created = await _create_access(client, anya)
    await run_outbox()
    assert (
        await _webhook(
            client, settings, request_id="ACC-1042", status="rejected", comment="Мало деталей"
        )
        == 200
    )

    request = (
        await client.get(f"/api/v1/requests/{created['request']['id']}", headers=anya.headers)
    ).json()
    plan = (await client.get("/api/v1/plan", headers=anya.headers)).json()
    stash = next(i for s in plan["stages"] for i in s["items"] if i["slug"] == "access-stash")
    assert request["status"] == "rejected"
    assert request["decision_comment"] == "Мало деталей"
    assert stash["status"] == "in_progress"


async def test_webhook_rejects_bad_signatures(client: AsyncClient, settings: Settings) -> None:
    unsigned = await client.post("/api/v1/integrations/corp/webhook", json={"event": "x"})
    stale = await client.post(
        "/api/v1/integrations/corp/webhook",
        content=b"{}",
        headers={
            "X-Corp-Timestamp": "1",
            "X-Corp-Signature": webhooks.sign("test-webhook-secret", "1", b"{}"),
        },
    )
    unknown = await _webhook(client, settings, request_id="ACC-0000", status="approved")

    assert unsigned.status_code == 401
    assert unsigned.json()["error_code"] == "WEBHOOK_SIGNATURE_INVALID"
    assert stale.status_code == 401
    assert unknown == 200


async def test_outage_is_retried_then_failed(
    client: AsyncClient, anya: Account, corp: FakeCorpServices, run_outbox: Outbox, db: Database
) -> None:
    corp.unavailable = True
    created = await _create_access(client, anya)
    await run_outbox()
    async with db.unit_of_work() as uow:
        await uow.session.execute(update(OutboxEvent).values(available_at=OutboxEvent.created_at))
    await run_outbox()

    request = (
        await client.get(f"/api/v1/requests/{created['request']['id']}", headers=anya.headers)
    ).json()
    assert request["status"] == "failed"
    notes = (await client.get("/api/v1/notifications", headers=anya.headers)).json()["items"]
    assert "не удалось отправить" in notes[0]["title"]


async def test_refusal_fails_the_request(
    client: AsyncClient, anya: Account, corp: FakeCorpServices, run_outbox: Outbox
) -> None:
    corp.refuse_with = "unknown resource"
    created = await _create_access(client, anya)
    await run_outbox()

    request = (
        await client.get(f"/api/v1/requests/{created['request']['id']}", headers=anya.headers)
    ).json()
    assert request["status"] == "failed"
    assert request["decision_comment"] == "unknown resource"


async def test_cancel_and_remind(
    client: AsyncClient, anya: Account, corp: FakeCorpServices, run_outbox: Outbox
) -> None:
    created = await _create_access(client, anya)
    early = await client.post(
        f"/api/v1/requests/{created['request']['id']}/remind", headers=anya.headers
    )
    assert early.status_code == 409

    await run_outbox()
    reminded = await client.post(
        f"/api/v1/requests/{created['request']['id']}/remind", headers=anya.headers
    )
    too_soon = await client.post(
        f"/api/v1/requests/{created['request']['id']}/remind", headers=anya.headers
    )
    cancelled = await client.post(
        f"/api/v1/requests/{created['request']['id']}/cancel", headers=anya.headers
    )

    assert reminded.status_code == 200
    assert corp.reminders == ["ACC-1042"]
    assert too_soon.json()["error_code"] == "REMIND_TOO_SOON"
    assert cancelled.json()["status"] == "cancelled"
    listed = (await client.get("/api/v1/requests?status=cancelled", headers=anya.headers)).json()
    assert len(listed) == 1


async def test_absence_check_and_request(
    client: AsyncClient, anya: Account, corp: FakeCorpServices, run_outbox: Outbox
) -> None:
    day = today() + timedelta(days=1)
    while day.weekday() >= 5:
        day += timedelta(days=1)
    corp.events.append(meeting("1:1 с наставником", day))
    body = {"type": "day_off", "start_date": day.isoformat(), "end_date": day.isoformat()}

    check = (
        await client.post("/api/v1/requests/absence/check", json=body, headers=anya.headers)
    ).json()
    created = await client.post(
        "/api/v1/requests/absence",
        json={**body, "comment": "Сессия", "idempotency_key": "abs-0001"},
        headers=anya.headers,
    )
    past = await client.post(
        "/api/v1/requests/absence/check",
        json={**body, "start_date": "2020-01-01", "end_date": "2020-01-01"},
        headers=anya.headers,
    )

    assert check["working_days"] == 1
    assert check["balance_after"] == 4
    assert any("1:1" in w for w in check["warnings"])
    assert created.status_code == 201
    assert created.json()["kind"] == "absence"
    assert past.status_code == 422
    await run_outbox()
    assert (await client.get("/api/v1/requests?kind=absence", headers=anya.headers)).json()[0][
        "status"
    ] == "submitted"


async def test_equipment_and_it_ticket(
    client: AsyncClient, anya: Account, corp: FakeCorpServices, run_outbox: Outbox
) -> None:
    corp.equipment_items[ANYA] = [laptop(EquipmentStatus.DELAYED, eta_days=-2)]
    equipment = (await client.get("/api/v1/equipment", headers=anya.headers)).json()
    ticket = await client.post(
        "/api/v1/requests/it-ticket",
        json={
            "category": "Ноутбук",
            "description": "Ноутбук задерживается",
            "idempotency_key": "it-ticket-0001",
        },
        headers=anya.headers,
    )

    assert equipment["items"][0]["status"] == "delayed"
    assert equipment["meanwhile"]
    assert ticket.status_code == 201
    await run_outbox()
    assert (await client.get("/api/v1/equipment", headers=anya.headers)).json()["ticket"][
        "status"
    ] == "submitted"


async def test_reconciliation_catches_lost_webhooks(
    client: AsyncClient,
    anya: Account,
    corp: FakeCorpServices,
    run_outbox: Outbox,
    db: Database,
    settings: Settings,
) -> None:
    created = await _create_access(client, anya)
    await run_outbox()
    corp.decide("ACC-1042", CorpTicketStatus.APPROVED, "Выдано")
    async with db.unit_of_work() as uow:
        await uow.session.execute(
            update(ServiceRequest).values(updated_at=ServiceRequest.updated_at - timedelta(hours=1))
        )

    assert await Nudges(db, corp, settings).reconcile() == 1
    request = (
        await client.get(f"/api/v1/requests/{created['request']['id']}", headers=anya.headers)
    ).json()
    assert request["status"] == "approved"


async def test_instant_approval_from_the_service(
    client: AsyncClient, anya: Account, corp: FakeCorpServices, run_outbox: Outbox
) -> None:
    corp.auto_decision = CorpTicketStatus.APPROVED
    created = await _create_access(client, anya)
    await run_outbox()

    request = (
        await client.get(f"/api/v1/requests/{created['request']['id']}", headers=anya.headers)
    ).json()
    assert request["status"] == "approved"


async def test_requests_are_private(client: AsyncClient, anya: Account, kirill: Account) -> None:
    created = await _create_access(client, anya)

    response = await client.get(
        f"/api/v1/requests/{created['request']['id']}", headers=kirill.headers
    )
    cancel = await client.post(
        f"/api/v1/requests/{created['request']['id']}/cancel", headers=kirill.headers
    )

    assert response.status_code == 404
    assert cancel.status_code == 404
    assert json.loads(response.text)["error_code"] == "REQUEST_NOT_FOUND"
