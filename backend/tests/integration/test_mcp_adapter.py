import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import pytest

from app.domain.corp import (
    CorpRequestError,
    CorpTicketStatus,
    CorpUnavailableError,
    EquipmentStatus,
)
from app.infra.corp_mcp import McpCorpServices

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
    server.state.reset()
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
    assert absence.external_id.startswith("ABS-")
    assert (await corp.absence_get(absence.external_id)).status is CorpTicketStatus.PENDING_APPROVAL
    assert items[0].status is EquipmentStatus.IN_TRANSIT
    assert (await corp.it_ticket_get(ticket.external_id)).approver == "IT-поддержка"
    assert message_id == "msg-1"


async def test_unreachable_service_is_unavailable() -> None:
    corp = McpCorpServices("http://127.0.0.1:9/mcp", timeout_sec=2)

    with pytest.raises(CorpUnavailableError):
        await corp.access_check(employee=ANYA, resource="jira-listings")
