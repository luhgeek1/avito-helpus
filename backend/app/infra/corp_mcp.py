import asyncio
import logging
from datetime import date, datetime
from typing import Any

from mcp import Client

from app.domain.corp import (
    AccessGrant,
    CorpEvent,
    CorpRequestError,
    CorpTicket,
    CorpTicketStatus,
    CorpUnavailableError,
    EquipmentItem,
    EquipmentStatus,
)
from app.infra.metrics import CORP_CALLS

logger = logging.getLogger(__name__)


class McpCorpServices:
    """
    `CorpServices` over MCP (streamable HTTP). One short session per call: the mock is local and
    stateless per request, and a per-call session never leaves a half-broken connection behind.
    Tool errors that mean "refused" carry `refused: true`; anything else is treated as transient.
    """

    def __init__(self, url: str, *, timeout_sec: float) -> None:
        self._url = url
        self._timeout = timeout_sec

    async def _call(self, tool: str, arguments: dict[str, Any]) -> dict[str, Any]:
        try:
            async with asyncio.timeout(self._timeout), Client(self._url) as client:
                result = await client.call_tool(tool, arguments)
        except TimeoutError as exc:
            CORP_CALLS.labels(tool=tool, outcome="timeout").inc()
            raise CorpUnavailableError(f"{tool}: timed out") from exc
        except Exception as exc:  # transport failures of any kind are retryable for us
            CORP_CALLS.labels(tool=tool, outcome="unavailable").inc()
            logger.warning("corp call %s failed: %r", tool, exc)
            raise CorpUnavailableError(f"{tool}: service unavailable") from exc

        data = _structured(result.structured_content)
        if result.is_error:
            text = " ".join(getattr(block, "text", "") for block in result.content).strip()
            CORP_CALLS.labels(tool=tool, outcome="error").inc()
            if "refused:" in text:
                raise CorpRequestError(text.split("refused:", 1)[1].strip() or None)
            raise CorpUnavailableError(text or f"{tool}: failed")
        CORP_CALLS.labels(tool=tool, outcome="ok").inc()
        return data

    async def access_check(self, *, employee: str, resource: str) -> AccessGrant:
        data = await self._call("access_check", {"employee": employee, "resource": resource})
        granted = data.get("granted_at")
        return AccessGrant(
            has_access=bool(data.get("has_access")),
            level=data.get("level"),
            granted_at=date.fromisoformat(granted) if granted else None,
        )

    async def access_create(
        self,
        *,
        employee: str,
        resource: str,
        level: str,
        justification: str,
        approver: str,
        idempotency_key: str,
    ) -> CorpTicket:
        data = await self._call(
            "access_create_request",
            {
                "employee": employee,
                "resource": resource,
                "level": level,
                "justification": justification,
                "approver": approver,
                "idempotency_key": idempotency_key,
            },
        )
        return _ticket(data)

    async def access_get(self, external_id: str) -> CorpTicket:
        return _ticket(await self._call("access_get_request", {"request_id": external_id}))

    async def access_remind(self, external_id: str) -> None:
        await self._call("access_remind", {"request_id": external_id})

    async def absence_balance(self, *, employee: str) -> int:
        data = await self._call("absence_balance", {"employee": employee})
        return int(data.get("days_left", 0))

    async def absence_create(
        self,
        *,
        employee: str,
        type_: str,
        start: date,
        end: date,
        comment: str,
        idempotency_key: str,
    ) -> CorpTicket:
        data = await self._call(
            "absence_create_request",
            {
                "employee": employee,
                "type": type_,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "comment": comment,
                "idempotency_key": idempotency_key,
            },
        )
        return _ticket(data)

    async def absence_get(self, external_id: str) -> CorpTicket:
        return _ticket(await self._call("absence_get_request", {"request_id": external_id}))

    async def calendar_events(self, *, employee: str, start: date, end: date) -> list[CorpEvent]:
        data = await self._call(
            "calendar_events",
            {"employee": employee, "date_from": start.isoformat(), "date_to": end.isoformat()},
        )
        return [
            CorpEvent(
                title=event["title"],
                starts_at=datetime.fromisoformat(event["starts_at"]),
                important=bool(event.get("important")),
            )
            for event in data.get("events", [])
        ]

    async def equipment(self, *, employee: str) -> list[EquipmentItem]:
        data = await self._call("itsupport_equipment", {"employee": employee})
        return [
            EquipmentItem(
                kind=item["kind"],
                model=item["model"],
                status=EquipmentStatus(item["status"]),
                eta=date.fromisoformat(item["eta"]) if item.get("eta") else None,
                pickup_location=item.get("pickup_location"),
                pickup_hours=item.get("pickup_hours"),
                note=item.get("note"),
            )
            for item in data.get("items", [])
        ]

    async def it_ticket_create(
        self, *, employee: str, category: str, description: str, idempotency_key: str
    ) -> CorpTicket:
        data = await self._call(
            "itsupport_create_ticket",
            {
                "employee": employee,
                "category": category,
                "description": description,
                "idempotency_key": idempotency_key,
            },
        )
        return _ticket(data)

    async def it_ticket_get(self, external_id: str) -> CorpTicket:
        return _ticket(await self._call("itsupport_get_ticket", {"ticket_id": external_id}))

    async def post_message(
        self, *, channel: str, text: str, author: str, idempotency_key: str
    ) -> str:
        data = await self._call(
            "messenger_post",
            {
                "channel": channel,
                "text": text,
                "author": author,
                "idempotency_key": idempotency_key,
            },
        )
        return str(data.get("message_id", ""))


def _structured(content: Any) -> dict[str, Any]:
    if not isinstance(content, dict):
        return {}
    # Tools returning a plain value are wrapped as {"result": ...} by the server SDK.
    inner = content.get("result")
    if len(content) == 1 and isinstance(inner, dict):
        return inner
    return content


def _ticket(data: dict[str, Any]) -> CorpTicket:
    return CorpTicket(
        external_id=str(data["request_id"]),
        status=CorpTicketStatus(data["status"]),
        comment=data.get("comment"),
        sla_hours=data.get("sla_hours"),
        approver=data.get("approver"),
    )
