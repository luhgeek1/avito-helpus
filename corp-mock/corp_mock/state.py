"""In-memory corporate services: access, absence, calendar, IT support, messenger.

Deterministic on purpose: the same request always gets the same decision, so demos and tests
are reproducible. Decisions arrive after `approval_delay_sec`, like a real approver.
"""

import json
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from itertools import count
from pathlib import Path
from typing import Any

from mcp.server.mcpserver.exceptions import ToolError

DATA = Path(__file__).resolve().parents[1] / "data" / "seed.json"
MIN_JUSTIFICATION = 15
WORKING_WEEK = 5


class Refused(ToolError):
    """The service understood the request and says no. Clients must not retry."""

    def __init__(self, message: str) -> None:
        super().__init__(f"refused: {message}")


class Unavailable(ToolError):
    """Simulated outage (fault mode). Clients should retry later."""


@dataclass
class Ticket:
    id: str
    service: str
    employee: str
    payload: dict[str, Any]
    status: str = "pending_approval"
    comment: str | None = None
    approver: str | None = None
    sla_hours: float = 24.0
    decision: tuple[str, str] = ("approved", "Готово")
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    reminders: int = 0

    def as_dict(self) -> dict[str, Any]:
        return {
            "request_id": self.id,
            "status": self.status,
            "comment": self.comment,
            "approver": self.approver,
            "sla_hours": self.sla_hours,
        }


class CorpState:
    def __init__(self, seed_path: Path = DATA) -> None:
        self._seed = json.loads(seed_path.read_text(encoding="utf-8"))
        self.reset()

    def reset(self) -> None:
        self.fault_mode = "ok"
        self.tickets: dict[str, Ticket] = {}
        self.by_key: dict[str, str] = {}
        self.messages: list[dict[str, Any]] = []
        self._ids = {"access": count(1042), "absence": count(2101), "itsupport": count(3301)}
        self.grants: dict[tuple[str, str], dict[str, Any]] = {}
        today = date.today()  # noqa: DTZ011 - the mock lives in local demo time
        for email, employee in self._seed["employees"].items():
            for grant in employee.get("grants", []):
                self.grants[(email, grant["resource"])] = {
                    "level": grant["level"],
                    "granted_at": (today - timedelta(days=grant["granted_days_ago"])).isoformat(),
                }
        self.balances = {e: d.get("absence_days", 0) for e, d in self._seed["employees"].items()}

    # ---- helpers ---------------------------------------------------------------------------

    def check_available(self) -> None:
        if self.fault_mode == "unavailable":
            raise Unavailable("service unavailable (fault injection)")

    def _new(self, service: str, prefix: str, employee: str, key: str, payload: dict[str, Any]) -> Ticket:
        if key in self.by_key:
            return self.tickets[self.by_key[key]]
        ticket = Ticket(id=f"{prefix}-{next(self._ids[service])}", service=service,
                        employee=employee, payload=payload)
        self.tickets[ticket.id] = ticket
        self.by_key[key] = ticket.id
        return ticket

    def ticket(self, ticket_id: str) -> Ticket:
        if ticket_id not in self.tickets:
            raise Refused(f"unknown request {ticket_id}")
        return self.tickets[ticket_id]

    # ---- access ----------------------------------------------------------------------------

    def access_check(self, employee: str, resource: str) -> dict[str, Any]:
        grant = self.grants.get((employee, resource))
        return {"has_access": grant is not None, **(grant or {})}

    def access_create(self, *, employee: str, resource: str, level: str, justification: str,
                      approver: str, key: str) -> Ticket:
        if resource not in self._seed["resources"]:
            raise Refused(f"unknown resource {resource}")
        ticket = self._new("access", "ACC", employee, key,
                           {"resource": resource, "level": level, "justification": justification})
        ticket.approver = approver or "Владелец ресурса"
        if level == "admin":
            ticket.decision = ("rejected", "Права администратора стажёрам не выдаются")
        elif len(justification.strip()) < MIN_JUSTIFICATION:
            ticket.decision = ("rejected", "Обоснование слишком короткое: опишите задачу, для которой нужен доступ")
        else:
            ticket.decision = ("approved", f"Доступ выдан: {self._seed['resources'][resource]}")
        return ticket

    # ---- absence ---------------------------------------------------------------------------

    def absence_create(self, *, employee: str, type_: str, start: date, end: date, comment: str,
                       key: str) -> Ticket:
        days = sum(1 for d in range((end - start).days + 1)
                   if (start + timedelta(days=d)).weekday() < WORKING_WEEK)
        ticket = self._new("absence", "ABS", employee, key,
                           {"type": type_, "start_date": start.isoformat(),
                            "end_date": end.isoformat(), "comment": comment, "days": days})
        ticket.approver = "Руководитель"
        if days > self.balances.get(employee, 0):
            ticket.decision = ("rejected", "Недостаточно дней")
        else:
            ticket.decision = ("approved", "Согласовано руководителем")
        return ticket

    def calendar(self, employee: str, start: date, end: date) -> list[dict[str, Any]]:
        template = self._seed["employees"].get(employee, {}).get("calendar")
        events = []
        for offset in range((end - start).days + 1):
            day = start + timedelta(days=offset)
            if day.weekday() >= WORKING_WEEK:
                continue
            for event in self._seed["calendar"].get(template, []):
                if event["weekday"] == "daily" or event["weekday"] == day.weekday():
                    hour, minute = map(int, event["time"].split(":"))
                    starts = datetime(day.year, day.month, day.day, hour, minute)  # noqa: DTZ001
                    events.append({"title": event["title"], "starts_at": starts.isoformat(),
                                   "important": event["important"]})
        return events

    # ---- IT --------------------------------------------------------------------------------

    def equipment(self, employee: str) -> list[dict[str, Any]]:
        today = date.today()  # noqa: DTZ011
        items = []
        for item in self._seed["employees"].get(employee, {}).get("equipment", []):
            eta = today + timedelta(days=item["eta_days"])
            items.append({**{k: v for k, v in item.items() if k != "eta_days"}, "eta": eta.isoformat()})
        return items

    def it_ticket(self, *, employee: str, category: str, description: str, key: str) -> Ticket:
        ticket = self._new("itsupport", "IT", employee, key,
                           {"category": category, "description": description})
        ticket.approver = "IT-поддержка"
        ticket.sla_hours = 8
        ticket.decision = ("approved", "Принято в работу: инженер свяжется в течение рабочего дня")
        return ticket

    def post(self, *, channel: str, text: str, author: str, key: str) -> str:
        for message in self.messages:
            if message["key"] == key:
                return str(message["id"])
        message_id = f"msg-{len(self.messages) + 1}"
        self.messages.append({"id": message_id, "key": key, "channel": channel, "text": text,
                              "author": author, "at": datetime.now(UTC).isoformat()})
        return message_id
