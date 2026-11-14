"""Corporate services: access, absence, calendar, IT support, messenger.

Deterministic on purpose: the same request always gets the same decision, so demos and tests
are reproducible. Decisions arrive after `approval_delay_sec`, like a real approver.

State lives in memory and, when a store file is given, survives restarts: a real corporate
service does not forget tickets and grants when it is redeployed, and Orbi's database keeps
the ticket numbers it was given.
"""

import json
import os
from dataclasses import asdict, dataclass, field
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from threading import RLock
from typing import Any
from zoneinfo import ZoneInfo

from mcp.server.mcpserver.exceptions import ToolError

DATA = Path(__file__).resolve().parents[1] / "data" / "seed.json"
MIN_JUSTIFICATION = 15
WORKING_WEEK = 5
LOCAL_TZ = ZoneInfo("Europe/Moscow")


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
    idempotency_key: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "request_id": self.id,
            "status": self.status,
            "comment": self.comment,
            "approver": self.approver,
            "sla_hours": self.sla_hours,
            "idempotency_key": self.idempotency_key,
        }


FIRST_IDS = {"access": 1042, "absence": 2101, "itsupport": 3301}


class CorpState:
    def __init__(self, seed_path: Path = DATA, store: Path | None = None) -> None:
        self._seed = json.loads(seed_path.read_text(encoding="utf-8"))
        self._store = store
        self._sequence_file = store.with_suffix(".sequences.json") if store is not None else None
        self._lock = RLock()
        self._next_ids = dict(FIRST_IDS)
        if self._sequence_file is not None and self._sequence_file.exists():
            saved = json.loads(self._sequence_file.read_text(encoding="utf-8"))
            if (
                not isinstance(saved, dict)
                or set(saved) != set(FIRST_IDS)
                or any(
                    not isinstance(saved[service], int) or saved[service] < first
                    for service, first in FIRST_IDS.items()
                )
            ):
                raise ValueError("Invalid ticket sequence checkpoint; restore it before starting")
            self._advance_sequences(saved)
        if store is not None and store.exists():
            self._restore(json.loads(store.read_text(encoding="utf-8")))
            self._save_sequences()
        else:
            self.reset()

    def reset(self, *, reset_sequence: bool = False) -> None:
        """Clear business state; rewind numbers only after a coordinated API database reset."""
        with self._lock:
            self.fault_mode = "ok"
            self.tickets: dict[str, Ticket] = {}
            self.by_key: dict[str, str] = {}
            self.messages: list[dict[str, Any]] = []
            self.reminder_keys: set[str] = set()
            if reset_sequence:
                self._next_ids = dict(FIRST_IDS)
            self.grants: dict[tuple[str, str], dict[str, Any]] = {}
            today = datetime.now(LOCAL_TZ).date()
            for email, employee in self._seed["employees"].items():
                for grant in employee.get("grants", []):
                    self.grants[(email, grant["resource"])] = {
                        "level": grant["level"],
                        "granted_at": (
                            today - timedelta(days=grant["granted_days_ago"])
                        ).isoformat(),
                    }
            self.balances = {
                e: d.get("absence_days", 0) for e, d in self._seed["employees"].items()
            }
            self.save()

    # ---- persistence -----------------------------------------------------------------------

    def save(self) -> None:
        """Write the whole state atomically; called after every change. No-op without a store."""
        with self._lock:
            self._save()

    def _save(self) -> None:
        if self._store is None:
            return
        self._save_sequences()
        snapshot = {
            "fault_mode": self.fault_mode,
            "tickets": [
                {**asdict(t), "created_at": t.created_at.isoformat()} for t in self.tickets.values()
            ],
            "by_key": self.by_key,
            "messages": self.messages,
            "reminder_keys": sorted(self.reminder_keys),
            "next_ids": self._next_ids,
            "grants": [{"employee": e, "resource": r, **g} for (e, r), g in self.grants.items()],
            "balances": self.balances,
        }
        _write_json(self._store, snapshot)

    def _advance_sequences(self, saved: dict[str, int]) -> None:
        for service, first in FIRST_IDS.items():
            self._next_ids[service] = max(self._next_ids[service], first, saved.get(service, first))

    def _save_sequences(self) -> None:
        if self._sequence_file is not None:
            _write_json(self._sequence_file, self._next_ids)

    def _restore(self, data: dict[str, Any]) -> None:
        self.fault_mode = data["fault_mode"]
        self.tickets = {}
        for raw in data["tickets"]:
            ticket = Ticket(
                **{
                    **raw,
                    "decision": tuple(raw["decision"]),
                    "created_at": datetime.fromisoformat(raw["created_at"]),
                }
            )
            self.tickets[ticket.id] = ticket
        self.by_key = data["by_key"]
        self.messages = data["messages"]
        self.reminder_keys = set(data.get("reminder_keys", []))
        self._advance_sequences(data.get("next_ids", {}))
        # Legacy snapshots may contain long ids; their numeric part still reserves the number.
        for ticket in self.tickets.values():
            number = ticket.id.split("-", 2)[1]
            self._advance_sequences({ticket.service: int(number) + 1})
        self.grants = {(g.pop("employee"), g.pop("resource")): g for g in data["grants"]}
        self.balances = data["balances"]

    def pending(self) -> list[Ticket]:
        """Tickets still waiting for a decision (to reschedule after a restart)."""
        return [t for t in self.tickets.values() if t.status == "pending_approval"]

    # ---- helpers ---------------------------------------------------------------------------

    def check_available(self) -> None:
        if self.fault_mode == "unavailable":
            raise Unavailable("service unavailable (fault injection)")

    def _new(
        self, service: str, prefix: str, employee: str, key: str, payload: dict[str, Any]
    ) -> Ticket:
        with self._lock:
            if key in self.by_key:
                existing = self.tickets[self.by_key[key]]
                if (existing.employee, existing.service, existing.payload) != (
                    employee,
                    service,
                    payload,
                ):
                    raise Refused("idempotency key reused with a different request")
                return existing
            number = self._next_ids[service]
            self._next_ids[service] = number + 1
            # Reserve before returning a ticket, independently of the business snapshot.
            self._save_sequences()
            ticket = Ticket(
                id=f"{prefix}-{number}",
                service=service,
                employee=employee,
                payload=payload,
                idempotency_key=key,
            )
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

    def access_create(
        self,
        *,
        employee: str,
        resource: str,
        level: str,
        justification: str,
        approver: str,
        key: str,
    ) -> Ticket:
        if level not in {"read", "write", "admin"}:
            raise Refused("unknown access level")
        if resource not in self._seed["resources"]:
            raise Refused(f"unknown resource {resource}")
        ticket = self._new(
            "access",
            "ACC",
            employee,
            key,
            {"resource": resource, "level": level, "justification": justification},
        )
        ticket.approver = approver or "Владелец ресурса"
        if level == "admin":
            ticket.decision = ("rejected", "Права администратора стажёрам не выдаются")
        elif len(justification.strip()) < MIN_JUSTIFICATION:
            ticket.decision = (
                "rejected",
                "Обоснование слишком короткое: опишите задачу, для которой нужен доступ",
            )
        else:
            ticket.decision = ("approved", f"Доступ выдан: {self._seed['resources'][resource]}")
        return ticket

    # ---- absence ---------------------------------------------------------------------------

    def absence_create(
        self, *, employee: str, type_: str, start: date, end: date, comment: str, key: str
    ) -> Ticket:
        if end < start or (end - start).days > 366 or type_ not in {"day_off", "vacation"}:
            raise Refused("invalid absence dates or type")
        if employee not in self.balances:
            raise Refused("unknown employee")
        days = sum(
            1
            for d in range((end - start).days + 1)
            if (start + timedelta(days=d)).weekday() < WORKING_WEEK
        )
        ticket = self._new(
            "absence",
            "ABS",
            employee,
            key,
            {
                "type": type_,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "comment": comment,
                "days": days,
            },
        )
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
                    starts = datetime(day.year, day.month, day.day, hour, minute, tzinfo=LOCAL_TZ)
                    events.append(
                        {
                            "title": event["title"],
                            "starts_at": starts.isoformat(),
                            "important": event["important"],
                        }
                    )
        return events

    # ---- IT --------------------------------------------------------------------------------

    def equipment(self, employee: str) -> list[dict[str, Any]]:
        today = datetime.now(LOCAL_TZ).date()
        items = []
        for item in self._seed["employees"].get(employee, {}).get("equipment", []):
            eta = today + timedelta(days=item["eta_days"])
            items.append(
                {**{k: v for k, v in item.items() if k != "eta_days"}, "eta": eta.isoformat()}
            )
        return items

    def it_ticket(self, *, employee: str, category: str, description: str, key: str) -> Ticket:
        ticket = self._new(
            "itsupport", "IT", employee, key, {"category": category, "description": description}
        )
        ticket.approver = "IT-поддержка"
        ticket.sla_hours = 8
        ticket.decision = ("approved", "Принято в работу: инженер свяжется в течение рабочего дня")
        return ticket

    def post(self, *, channel: str, text: str, author: str, key: str) -> str:
        for message in self.messages:
            if message["key"] == key:
                return str(message["id"])
        message_id = f"msg-{len(self.messages) + 1}"
        self.messages.append(
            {
                "id": message_id,
                "key": key,
                "channel": channel,
                "text": text,
                "author": author,
                "at": datetime.now(UTC).isoformat(),
            }
        )
        return message_id


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as output:
        json.dump(data, output, ensure_ascii=False)
        output.flush()
        os.fsync(output.fileno())
    os.replace(tmp, path)
