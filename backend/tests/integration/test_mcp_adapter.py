import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any
from uuid import UUID

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.db.database import Database
from app.domain.corp import (
    CorpRequestError,
    CorpTicketStatus,
    CorpUnavailableError,
    EquipmentStatus,
)
from app.infra.corp_mcp import McpCorpServices
from app.seed.loader import seed
from app.service.requests import submit_request
from tests.integration.conftest import login

CORP_MOCK = Path(__file__).resolve().parents[3] / "corp-mock"
ANYA = "anya.intern@buddy.test"


@pytest.fixture
def corp_mock() -> Any:
    """The real corp-mock MCP server, connected in memory (no ports, no Docker)."""
    sys.path.insert(0, str(CORP_MOCK))
    try:
        from corp_mock import server  # noqa: PLC0415 - corp-mock is not an installed package
    finally:
        sys.path.remove(str(CORP_MOCK))
    server.state.reset(reset_sequence=True)
    return server


async def test_access_through_mcp(corp_mock: Any) -> None:
    corp = McpCorpServices(corp_mock.mcp, timeout_sec=5)

    granted = await corp.access_check(employee=ANYA, resource="jira-listings")
    ticket = await corp.access_create(
        employee=ANYA, resource="stash-listings-api", level="write",
        justification="Задача LST-1432 про цены", approver="Мария Ким", idempotency_key="k-1",
    )  # fmt: skip
    same = await corp.access_create(
        employee=ANYA, resource="stash-listings-api", level="write",
        justification="Задача LST-1432 про цены", approver="Мария Ким", idempotency_key="k-1",
    )  # fmt: skip
    fetched = await corp.access_get(ticket.external_id)
    await corp.access_remind(ticket.external_id)

    assert granted.has_access
    assert granted.level == "write"
    assert ticket.status is CorpTicketStatus.PENDING_APPROVAL
    assert ticket.external_id == "ACC-1042"
    assert same.external_id == ticket.external_id == fetched.external_id
    assert corp_mock.state.tickets[ticket.external_id].reminders == 1


async def test_refusals_and_outages_map_to_domain_errors(corp_mock: Any) -> None:
    corp = McpCorpServices(corp_mock.mcp, timeout_sec=5)

    with pytest.raises(CorpRequestError, match="unknown resource"):
        await corp.access_create(
            employee=ANYA, resource="nope", level="read", justification="x" * 20,
            approver="a", idempotency_key="k-2",
        )  # fmt: skip
    corp_mock.state.fault_mode = "unavailable"
    with pytest.raises(CorpUnavailableError):
        await corp.absence_balance(employee=ANYA)


async def test_absence_calendar_equipment_and_messages(corp_mock: Any) -> None:
    corp = McpCorpServices(corp_mock.mcp, timeout_sec=5)
    monday = date.today() + timedelta(days=(7 - date.today().weekday()))

    balance = await corp.absence_balance(employee=ANYA)
    events = await corp.calendar_events(employee=ANYA, start=monday, end=monday + timedelta(days=4))
    absence = await corp.absence_create(
        employee=ANYA, type_="day_off", start=monday, end=monday, comment="", idempotency_key="a-1"
    )
    items = await corp.equipment(employee=ANYA)
    ticket = await corp.it_ticket_create(
        employee=ANYA, category="Ноутбук", description="Задерживается", idempotency_key="i-1"
    )
    message_id = await corp.post_message(
        channel="#x", text="привет", author=ANYA, idempotency_key="m-1"
    )

    assert balance == 5
    assert any(e.title == "1:1 с наставником" and e.important for e in events)
    assert absence.external_id == "ABS-2101"
    assert ticket.external_id == "IT-3301"
    assert (await corp.absence_get(absence.external_id)).status is CorpTicketStatus.PENDING_APPROVAL
    assert items[0].status is EquipmentStatus.IN_TRANSIT
    assert (await corp.it_ticket_get(ticket.external_id)).approver == "IT-поддержка"
    assert message_id == "msg-1"


async def test_unreachable_service_is_unavailable() -> None:
    corp = McpCorpServices("http://127.0.0.1:9/mcp", timeout_sec=2)

    with pytest.raises(CorpUnavailableError):
        await corp.access_check(employee=ANYA, resource="jira-listings")


async def test_state_survives_restart_and_demo_reset(corp_mock: Any, tmp_path: Path) -> None:
    store = tmp_path / "state.json"
    first = corp_mock.state.__class__(store=store)
    ticket = first.access_create(
        employee=ANYA, resource="stash-listings-api", level="write",
        justification="Задача LST-1432 про цены", approver="Мария Ким", key="k-1",
    )  # fmt: skip
    first.grants[(ANYA, "stash-listings-api")] = {"level": "write", "granted_at": "2026-11-14"}
    first.save()

    restarted = corp_mock.state.__class__(store=store)
    second = restarted.access_create(
        employee=ANYA, resource="stash-listings-api", level="write",
        justification="Задача LST-1433 про цены", approver="Мария Ким", key="k-2",
    )  # fmt: skip

    assert restarted.tickets[ticket.id].decision == ticket.decision
    assert [t.id for t in restarted.pending()] == [ticket.id, second.id]
    assert second.id == "ACC-1043"
    assert restarted.access_check(ANYA, "stash-listings-api")["has_access"]

    corp = McpCorpServices(corp_mock.mcp, timeout_sec=5)
    await corp.access_create(
        employee=ANYA, resource="stash-listings-api", level="write",
        justification="Задача LST-1432 про цены", approver="Мария Ким", idempotency_key="k-3",
    )  # fmt: skip
    await corp.reset_demo()

    assert corp_mock.state.tickets == {}


async def test_reset_does_not_reuse_another_requests_number(corp_mock: Any) -> None:
    corp = McpCorpServices(corp_mock.mcp, timeout_sec=5)
    first = await corp.it_ticket_create(
        employee=ANYA,
        category="Ноутбук",
        description="Не включается",
        idempotency_key="before-reset",
    )
    await corp.reset_demo()
    second = await corp.it_ticket_create(
        employee=ANYA,
        category="Ноутбук",
        description="Не включается",
        idempotency_key="after-reset",
    )
    assert first.external_id != second.external_id
    assert first.external_id == "IT-3301"
    assert second.external_id == "IT-3302"
    assert re.fullmatch(r"IT-\d+", second.external_id)
    assert second.idempotency_key == "after-reset"


async def test_sequence_survives_reset_and_missing_snapshot(corp_mock: Any, tmp_path: Path) -> None:
    store = tmp_path / "state.json"
    state = corp_mock.state.__class__(store=store)
    first = state.it_ticket(employee=ANYA, category="Laptop", description="Test", key="first")
    state.reset()
    restarted = state.__class__(store=store)
    second = restarted.it_ticket(employee=ANYA, category="Laptop", description="Test", key="second")
    # No snapshot save: the allocated number must already be reserved durably.
    store.unlink()
    recovered = state.__class__(store=store)
    third = recovered.it_ticket(employee=ANYA, category="Laptop", description="Test", key="third")
    assert [first.id, second.id, third.id] == ["IT-3301", "IT-3302", "IT-3303"]


async def test_legacy_long_numbers_remain_readable(corp_mock: Any, tmp_path: Path) -> None:
    store = tmp_path / "legacy.json"
    state = corp_mock.state.__class__(store=store)
    state.it_ticket(employee=ANYA, category="Laptop", description="Test", key="old")
    state.save()
    raw = json.loads(store.read_text(encoding="utf-8"))
    long_id = "IT-3301-1340525029ba2ad861b39159"
    raw["tickets"][0]["id"] = long_id
    raw["by_key"]["old"] = long_id
    raw["next_ids"]["itsupport"] = 3301  # recover the high-water mark from tickets as well
    store.write_text(json.dumps(raw), encoding="utf-8")
    store.with_suffix(".sequences.json").unlink(missing_ok=True)
    restored = state.__class__(store=store)
    assert restored.ticket(long_id).id == long_id
    assert (
        restored.it_ticket(employee=ANYA, category="Laptop", description="Test", key="old").id
        == long_id
    )
    fresh = restored.it_ticket(employee=ANYA, category="Laptop", description="Test", key="new")
    assert fresh.id == "IT-3302"


async def test_only_explicit_coordinated_reset_rewinds_numbers(
    corp_mock: Any, tmp_path: Path
) -> None:
    store = tmp_path / "state.json"
    state = corp_mock.state.__class__(store=store)
    state.it_ticket(employee=ANYA, category="Laptop", description="Test", key="first")
    state.reset(reset_sequence=True)
    restored = state.__class__(store=store)
    ticket = restored.it_ticket(employee=ANYA, category="Laptop", description="Test", key="demo")
    assert ticket.id == "IT-3301"


async def test_http_reset_keeps_numbers_unless_explicit(corp_mock: Any) -> None:
    async with AsyncClient(
        transport=ASGITransport(app=corp_mock.app), base_url="http://corp"
    ) as client:
        state = corp_mock.state
        state.it_ticket(employee=ANYA, category="Laptop", description="Test", key="first")
        assert (await client.post("/admin/reset")).status_code == 200
        assert (
            state.it_ticket(employee=ANYA, category="Laptop", description="Test", key="second").id
            == "IT-3302"
        )
        assert (await client.post("/admin/reset?reset_sequence=true")).status_code == 200
        assert (
            state.it_ticket(employee=ANYA, category="Laptop", description="Test", key="demo").id
            == "IT-3301"
        )


async def test_sequence_reservation_wins_over_stale_snapshot(
    corp_mock: Any, tmp_path: Path
) -> None:
    store = tmp_path / "state.json"
    state = corp_mock.state.__class__(store=store)
    state.it_ticket(employee=ANYA, category="Laptop", description="Test", key="first")
    # Simulate a crash before the normal handler saves the newly created ticket.
    recovered = state.__class__(store=store)
    ticket = recovered.it_ticket(employee=ANYA, category="Laptop", description="Test", key="second")
    assert ticket.id == "IT-3302"


async def test_first_anya_request_after_coordinated_reset_has_demo_number(
    corp_mock: Any,
    client: AsyncClient,
    app: FastAPI,
    db: Database,
    settings: Settings,
) -> None:
    corp = McpCorpServices(corp_mock.mcp, timeout_sec=5)
    await corp.it_ticket_create(
        employee=ANYA, category="Laptop", description="Test", idempotency_key="before-reset"
    )
    await seed(db, reset=True)
    corp_mock.demo_reset(reset_sequence=True)
    app.state.corp = corp
    anya = await login(client, ANYA)
    created = await client.post(
        "/api/v1/requests/access",
        headers=anya.headers,
        json={"resource": "stash-listings-api", "idempotency_key": "demo-after-reset"},
    )
    request_id = created.json()["request"]["id"]
    await submit_request(db, corp, settings, UUID(request_id))
    saved = (await client.get(f"/api/v1/requests/{request_id}", headers=anya.headers)).json()
    assert saved["external_id"] == "ACC-1042"
    assert saved["status"] == "submitted"


@pytest.mark.parametrize("raw", ["", "{}", '{"access": 1}'])
async def test_invalid_sequence_checkpoint_fails_closed(
    corp_mock: Any, tmp_path: Path, raw: str
) -> None:
    store = tmp_path / "state.json"
    store.with_suffix(".sequences.json").write_text(raw, encoding="utf-8")
    with pytest.raises(ValueError, match=r"Expecting value|Invalid ticket sequence"):
        corp_mock.state.__class__(store=store)


async def test_mock_decisions_are_idempotent_and_balance_cannot_go_negative(corp_mock: Any) -> None:
    corp = McpCorpServices(corp_mock.mcp, timeout_sec=5)
    monday = date(2026, 11, 16)
    tickets = [
        await corp.absence_create(
            employee=ANYA,
            type_="day_off",
            start=monday,
            end=monday + timedelta(days=2),
            comment="",
            idempotency_key=f"absence-{i}",
        )
        for i in range(2)
    ]
    first = corp_mock.state.ticket(tickets[0].external_id)
    second = corp_mock.state.ticket(tickets[1].external_id)
    corp_mock.decide(first, "approved", "ok")
    corp_mock.decide(first, "approved", "duplicate")
    corp_mock.decide(second, "approved", "raced")
    assert corp_mock.state.balances[ANYA] == 2
    assert second.status == "rejected"


async def test_mock_reminders_dedupe_and_cancel_is_final(corp_mock: Any) -> None:
    corp = McpCorpServices(corp_mock.mcp, timeout_sec=5)
    ticket = await corp.it_ticket_create(
        employee=ANYA, category="Ноутбук", description="Не включается", idempotency_key="cancel-key"
    )
    await corp.access_remind(ticket.external_id, idempotency_key="reminder-key")
    await corp.access_remind(ticket.external_id, idempotency_key="reminder-key")
    assert corp_mock.state.ticket(ticket.external_id).reminders == 1
    assert (await corp.cancel_request(ticket.external_id)).status is CorpTicketStatus.CANCELLED
    assert (await corp.cancel_request(ticket.external_id)).status is CorpTicketStatus.CANCELLED
