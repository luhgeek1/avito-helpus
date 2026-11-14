from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from itertools import count
from typing import Any

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


@dataclass
class FakeCorpServices:
    """In-process stand-in for the corporate services port, with knobs for failure paths."""

    grants: dict[tuple[str, str], AccessGrant] = field(default_factory=dict)
    balances: dict[str, int] = field(default_factory=dict)
    events: list[CorpEvent] = field(default_factory=list)
    equipment_items: dict[str, list[EquipmentItem]] = field(default_factory=dict)
    tickets: dict[str, CorpTicket] = field(default_factory=dict)
    by_key: dict[str, str] = field(default_factory=dict)
    messages: list[dict[str, str]] = field(default_factory=list)
    reminders: list[str] = field(default_factory=list)
    calls: list[str] = field(default_factory=list)
    unavailable: bool = False
    refuse_with: str | None = None
    auto_decision: CorpTicketStatus | None = None
    _ids: Any = field(default_factory=lambda: count(1042))

    def _guard(self, name: str) -> None:
        self.calls.append(name)
        if self.unavailable:
            raise CorpUnavailableError(f"{name}: service unavailable")
        if self.refuse_with and name.endswith("_create"):
            raise CorpRequestError(self.refuse_with)

    def _ticket(self, prefix: str, key: str, approver: str | None) -> CorpTicket:
        if key in self.by_key:
            return self.tickets[self.by_key[key]]
        status = self.auto_decision or CorpTicketStatus.PENDING_APPROVAL
        ticket = CorpTicket(
            external_id=f"{prefix}-{next(self._ids)}",
            status=status,
            sla_hours=24,
            approver=approver,
            comment="Сразу одобрено" if status is CorpTicketStatus.APPROVED else None,
        )
        self.tickets[ticket.external_id] = ticket
        self.by_key[key] = ticket.external_id
        return ticket

    def decide(
        self, external_id: str, status: CorpTicketStatus, comment: str | None = None
    ) -> None:
        ticket = self.tickets[external_id]
        self.tickets[external_id] = CorpTicket(
            external_id=ticket.external_id, status=status, comment=comment, sla_hours=24
        )

    async def access_check(self, *, employee: str, resource: str) -> AccessGrant:
        self._guard("access_check")
        return self.grants.get((employee, resource), AccessGrant(has_access=False))

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
        self._guard("access_create")
        return self._ticket("ACC", idempotency_key, approver)

    async def access_get(self, external_id: str) -> CorpTicket:
        self._guard("access_get")
        return self.tickets[external_id]

    async def access_remind(self, external_id: str) -> None:
        self._guard("access_remind")
        self.reminders.append(external_id)

    async def absence_balance(self, *, employee: str) -> int:
        self._guard("absence_balance")
        return self.balances.get(employee, 5)

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
        self._guard("absence_create")
        return self._ticket("ABS", idempotency_key, "Руководитель")

    async def absence_get(self, external_id: str) -> CorpTicket:
        self._guard("absence_get")
        return self.tickets[external_id]

    async def calendar_events(self, *, employee: str, start: date, end: date) -> list[CorpEvent]:
        self._guard("calendar_events")
        return [e for e in self.events if start <= e.starts_at.date() <= end]

    async def equipment(self, *, employee: str) -> list[EquipmentItem]:
        self._guard("equipment")
        return self.equipment_items.get(employee, [])

    async def it_ticket_create(
        self, *, employee: str, category: str, description: str, idempotency_key: str
    ) -> CorpTicket:
        self._guard("it_ticket_create")
        return self._ticket("IT", idempotency_key, "IT-поддержка")

    async def it_ticket_get(self, external_id: str) -> CorpTicket:
        self._guard("it_ticket_get")
        return self.tickets[external_id]

    async def post_message(
        self, *, channel: str, text: str, author: str, idempotency_key: str
    ) -> str:
        self._guard("post_message")
        self.messages.append({"channel": channel, "text": text, "author": author})
        return f"msg-{len(self.messages)}"


def laptop(status: EquipmentStatus, *, eta_days: int = 1) -> EquipmentItem:
    return EquipmentItem(
        kind="laptop",
        model="MacBook Pro 14",
        status=status,
        eta=date.today() + timedelta(days=eta_days),
        pickup_location="IT-стойка, 5 этаж",
        pickup_hours="будни 10:00–18:00",
    )


def meeting(title: str, on: date, *, important: bool = True) -> CorpEvent:
    return CorpEvent(
        title=title, starts_at=datetime(on.year, on.month, on.day, 15), important=important
    )


class FakeEmbeddings:
    """Deterministic bag-of-letters vectors: similar texts get similar vectors, no network."""

    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.calls = 0

    def _vector(self, text: str) -> list[float]:
        vector = [0.0] * 1024
        for index, char in enumerate(text.lower()):
            vector[(ord(char) * 31 + index % 7) % 1024] += 1.0
        norm = sum(v * v for v in vector) ** 0.5 or 1.0
        return [v / norm for v in vector]

    async def embed_query(self, text: str) -> Sequence[float]:
        self.calls += 1
        if self.fail:
            raise RuntimeError("embeddings are down")
        return self._vector(text)

    async def embed_documents(self, texts: Sequence[str]) -> list[Sequence[float]]:
        self.calls += 1
        return [self._vector(text) for text in texts]


class RecordingPublisher:
    def __init__(self) -> None:
        self.events: list[tuple[str, str, dict[str, Any]]] = []

    async def publish(self, user_id: str, event: str, data: dict[str, Any]) -> None:
        self.events.append((user_id, event, data))


class FakeGenerator:
    def __init__(self, answer: str | None) -> None:
        self.answer = answer
        self.prompts: list[str] = []

    async def generate(self, instructions: str, prompt: str) -> str | None:
        self.prompts.append(prompt)
        return self.answer
