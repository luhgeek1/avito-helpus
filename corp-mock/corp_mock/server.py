"""MCP server imitating corporate services (streamable HTTP at /mcp) plus admin routes.

Run: `uvicorn corp_mock.server:app --port 8090`. Decisions are pushed to Orbi's webhook with an
HMAC signature; `POST /admin/faults {"mode": "unavailable"}` simulates an outage.
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import Any

import httpx
from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings
from starlette.requests import Request
from starlette.responses import JSONResponse

from corp_mock.state import CorpState, Ticket

logger = logging.getLogger("corp_mock")

APPROVAL_DELAY_SEC = float(os.environ.get("MOCK_APPROVAL_DELAY_SEC", "20"))
WEBHOOK_URL = os.environ.get("BUDDY_WEBHOOK_URL", "http://localhost:8080/api/v1/integrations/corp/webhook")
WEBHOOK_SECRET = os.environ.get("CORP_WEBHOOK_SECRET", "dev-webhook-secret")
# Where tickets and grants are kept between restarts (a file on a volume); unset = memory only.
STATE_FILE = os.environ.get("CORP_STATE_FILE")

state = CorpState(store=Path(STATE_FILE) if STATE_FILE else None)
mcp = MCPServer(
    "corp-mock",
    instructions="Имитация корпоративных сервисов: доступы, отсутствия, календарь, IT, мессенджер.",
)
_tasks: set[asyncio.Task[None]] = set()


def _sign(timestamp: str, body: bytes) -> str:
    digest = hmac.new(WEBHOOK_SECRET.encode(), timestamp.encode() + b"." + body, hashlib.sha256)
    return "sha256=" + digest.hexdigest()


async def _deliver(ticket: Ticket) -> None:
    body = json.dumps({"event": "request.status_changed", "service": ticket.service,
                       "request_id": ticket.id, "status": ticket.status,
                       "comment": ticket.comment}, ensure_ascii=False).encode()
    for attempt in range(5):
        timestamp = str(int(time.time()))
        headers = {"Content-Type": "application/json", "X-Corp-Timestamp": timestamp,
                   "X-Corp-Signature": _sign(timestamp, body)}
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                response = await client.post(WEBHOOK_URL, content=body, headers=headers)
            if response.status_code < 500:
                logger.info("webhook %s -> %s", ticket.id, response.status_code)
                return
        except httpx.HTTPError as exc:
            logger.warning("webhook %s failed: %r", ticket.id, exc)
        await asyncio.sleep(2 ** attempt)


async def _decide_later(ticket: Ticket, delay: float) -> None:
    await asyncio.sleep(delay)
    if ticket.status != "pending_approval":
        return
    decide(ticket, *ticket.decision)
    await _deliver(ticket)


def decide(ticket: Ticket, status: str, comment: str | None) -> None:
    ticket.status = status
    ticket.comment = comment
    if status == "approved" and ticket.service == "access":
        state.grants[(ticket.employee, ticket.payload["resource"])] = {
            "level": ticket.payload["level"], "granted_at": date.today().isoformat(),  # noqa: DTZ011
        }
    if status == "approved" and ticket.service == "absence":
        state.balances[ticket.employee] -= ticket.payload["days"]
    state.save()


def _schedule(ticket: Ticket) -> None:
    if ticket.status != "pending_approval" or any(t.get_name() == ticket.id for t in _tasks):
        return
    task = asyncio.get_running_loop().create_task(_decide_later(ticket, APPROVAL_DELAY_SEC), name=ticket.id)
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)


# ---- MCP tools ----------------------------------------------------------------------------------


@mcp.tool()
def access_check(employee: str, resource: str) -> dict[str, Any]:
    """Does the employee already have access to the resource, and at which level."""
    state.check_available()
    return state.access_check(employee, resource)


@mcp.tool()
async def access_create_request(employee: str, resource: str, level: str, justification: str,
                                approver: str, idempotency_key: str) -> dict[str, Any]:
    """Register an access request (idempotent by key). The decision comes later via webhook."""
    state.check_available()
    ticket = state.access_create(employee=employee, resource=resource, level=level,
                                 justification=justification, approver=approver, key=idempotency_key)
    state.save()
    _schedule(ticket)
    return ticket.as_dict()


@mcp.tool()
def access_get_request(request_id: str) -> dict[str, Any]:
    """Current status of an access request."""
    state.check_available()
    return state.ticket(request_id).as_dict()


@mcp.tool()
def access_remind(request_id: str) -> dict[str, Any]:
    """Send the approver a reminder."""
    state.check_available()
    ticket = state.ticket(request_id)
    ticket.reminders += 1
    state.save()
    return {"request_id": ticket.id, "reminders": ticket.reminders}


@mcp.tool()
def absence_balance(employee: str) -> dict[str, Any]:
    """Days off the employee has left."""
    state.check_available()
    return {"days_left": state.balances.get(employee, 0)}


@mcp.tool()
async def absence_create_request(employee: str, type: str, start_date: str, end_date: str,  # noqa: A002
                                 comment: str, idempotency_key: str) -> dict[str, Any]:
    """Register a day off or vacation request (idempotent by key)."""
    state.check_available()
    ticket = state.absence_create(employee=employee, type_=type, start=date.fromisoformat(start_date),
                                  end=date.fromisoformat(end_date), comment=comment, key=idempotency_key)
    state.save()
    _schedule(ticket)
    return ticket.as_dict()


@mcp.tool()
def absence_get_request(request_id: str) -> dict[str, Any]:
    """Current status of an absence request."""
    state.check_available()
    return state.ticket(request_id).as_dict()


@mcp.tool()
def calendar_events(employee: str, date_from: str, date_to: str) -> dict[str, Any]:
    """Employee's calendar events between two dates (inclusive)."""
    state.check_available()
    return {"events": state.calendar(employee, date.fromisoformat(date_from), date.fromisoformat(date_to))}


@mcp.tool()
def itsupport_equipment(employee: str) -> dict[str, Any]:
    """Equipment assigned to the employee: status, ETA, pickup place and hours."""
    state.check_available()
    return {"items": state.equipment(employee)}


@mcp.tool()
async def itsupport_create_ticket(employee: str, category: str, description: str,
                                  idempotency_key: str) -> dict[str, Any]:
    """Open an IT support ticket (idempotent by key)."""
    state.check_available()
    ticket = state.it_ticket(employee=employee, category=category, description=description,
                             key=idempotency_key)
    state.save()
    _schedule(ticket)
    return ticket.as_dict()


@mcp.tool()
def itsupport_get_ticket(ticket_id: str) -> dict[str, Any]:
    """Current status of an IT ticket."""
    state.check_available()
    return state.ticket(ticket_id).as_dict()


@mcp.tool()
def messenger_post(channel: str, text: str, author: str, idempotency_key: str) -> dict[str, Any]:
    """Post a message to a team channel (idempotent by key)."""
    state.check_available()
    message_id = state.post(channel=channel, text=text, author=author, key=idempotency_key)
    state.save()
    return {"message_id": message_id}


@mcp.tool()
def demo_reset() -> dict[str, Any]:
    """Demo control: forget all tickets, grants and messages and return to the seed state."""
    for task in list(_tasks):
        task.cancel()
    state.reset()
    return {"status": "reset"}


# ---- admin routes (demo control, not part of the MCP contract) -----------------------------------


@mcp.custom_route("/health", methods=["GET"])
async def health(_: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "fault_mode": state.fault_mode})


@mcp.custom_route("/admin/state", methods=["GET"])
async def dump(_: Request) -> JSONResponse:
    return JSONResponse({
        "fault_mode": state.fault_mode,
        "tickets": [{**t.as_dict(), "service": t.service, "employee": t.employee, "payload": t.payload}
                    for t in state.tickets.values()],
        "messages": state.messages,
        "grants": [{"employee": e, "resource": r, **g} for (e, r), g in state.grants.items()],
    })


@mcp.custom_route("/admin/faults", methods=["POST"])
async def faults(request: Request) -> JSONResponse:
    mode = (await request.json()).get("mode", "ok")
    state.fault_mode = mode if mode in {"ok", "unavailable"} else "ok"
    state.save()
    return JSONResponse({"fault_mode": state.fault_mode})


@mcp.custom_route("/admin/decide", methods=["POST"])
async def decide_now(request: Request) -> JSONResponse:
    """Force a decision right away (handy for live demos)."""
    payload = await request.json()
    ticket = state.ticket(payload["request_id"])
    status = payload.get("status") or ticket.decision[0]
    decide(ticket, status, payload.get("comment") or ticket.decision[1])
    await _deliver(ticket)
    return JSONResponse(ticket.as_dict())


@mcp.custom_route("/admin/reset", methods=["POST"])
async def reset(_: Request) -> JSONResponse:
    return JSONResponse(demo_reset())


app = mcp.streamable_http_app(
    stateless_http=True,
    json_response=True,
    # Inside docker-compose the host is "corp-mock", not localhost.
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)

_serve = app.router.lifespan_context


@asynccontextmanager
async def _lifespan(server: Any) -> AsyncIterator[None]:
    # Tickets restored from the store still owe Orbi a decision.
    for ticket in state.pending():
        _schedule(ticket)
    async with _serve(server):
        yield


app.router.lifespan_context = _lifespan
