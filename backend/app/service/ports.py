from collections.abc import Sequence
from datetime import date
from typing import Any, Protocol

from app.domain.corp import AccessGrant, CorpEvent, CorpTicket, EquipmentItem


class CorpServices(Protocol):
    """
    The corporate services Orbi works with. Today an MCP mock implements it; a real Jira
    Service Desk or the Avito access service would be another adapter of the same port.
    Calls that create something take an idempotency key, so retries never duplicate.
    """

    async def access_check(self, *, employee: str, resource: str) -> AccessGrant: ...

    async def access_create(
        self,
        *,
        employee: str,
        resource: str,
        level: str,
        justification: str,
        approver: str,
        idempotency_key: str,
    ) -> CorpTicket: ...

    async def access_get(self, external_id: str) -> CorpTicket: ...

    async def access_remind(self, external_id: str) -> None: ...

    async def absence_balance(self, *, employee: str) -> int: ...

    async def absence_create(
        self,
        *,
        employee: str,
        type_: str,
        start: date,
        end: date,
        comment: str,
        idempotency_key: str,
    ) -> CorpTicket: ...

    async def absence_get(self, external_id: str) -> CorpTicket: ...

    async def calendar_events(
        self, *, employee: str, start: date, end: date
    ) -> list[CorpEvent]: ...

    async def equipment(self, *, employee: str) -> list[EquipmentItem]: ...

    async def it_ticket_create(
        self, *, employee: str, category: str, description: str, idempotency_key: str
    ) -> CorpTicket: ...

    async def it_ticket_get(self, external_id: str) -> CorpTicket: ...

    async def post_message(
        self, *, channel: str, text: str, author: str, idempotency_key: str
    ) -> str: ...

    async def reset_demo(self) -> None:
        """Demo control: return the services to their seed state (tickets, grants, balances)."""
        ...


class Embeddings(Protocol):
    async def embed_query(self, text: str) -> Sequence[float]: ...

    async def embed_documents(self, texts: Sequence[str]) -> list[Sequence[float]]: ...


class Publisher(Protocol):
    """Pushes realtime events to a user's open SSE streams."""

    async def publish(self, user_id: str, event: str, data: dict[str, Any]) -> None: ...


class TextGenerator(Protocol):
    """One-shot generation for background jobs (digests, conflict checks)."""

    async def generate(self, instructions: str, prompt: str) -> str | None: ...
