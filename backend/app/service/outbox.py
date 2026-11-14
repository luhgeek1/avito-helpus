import logging
from collections.abc import Awaitable, Callable, Mapping
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from app.core.config import Settings
from app.db.database import Database
from app.db.models import OutboxEvent
from app.domain.events import OutboxStatus, Topic
from app.infra.metrics import OUTBOX_EVENTS
from app.service.knowledge import KnowledgeService
from app.service.ports import CorpServices, Embeddings, Publisher
from app.service.requests import fail_request, submit_request

logger = logging.getLogger(__name__)

Handler = Callable[[dict[str, Any]], Awaitable[None]]

_MAX_RETRY_DELAY = timedelta(hours=1)
_ERROR_TEXT_MAX = 2000


def retry_delay(attempt: int) -> timedelta:
    """Exponential backoff: 2 s, 4 s, 8 s ... capped at one hour."""
    return min(timedelta(seconds=2**attempt), _MAX_RETRY_DELAY)


def build_handlers(
    *,
    db: Database,
    corp: CorpServices,
    publisher: Publisher,
    embeddings: Embeddings | None,
    settings: Settings,
) -> tuple[dict[str, Handler], dict[str, Handler]]:
    """Handlers per topic, plus "dead" handlers that run once when retries are exhausted."""

    async def request_submit(payload: dict[str, Any]) -> None:
        await submit_request(db, corp, settings, UUID(payload["request_id"]))

    async def request_dead(payload: dict[str, Any]) -> None:
        await fail_request(db, corp, settings, UUID(payload["request_id"]))

    async def realtime_publish(payload: dict[str, Any]) -> None:
        await publisher.publish(payload["user_id"], payload["event"], payload["data"])

    async def kb_embed(_: dict[str, Any]) -> None:
        async with db.unit_of_work() as uow:
            await KnowledgeService(uow, embeddings).embed_pending()

    async def messenger_post(payload: dict[str, Any]) -> None:
        await corp.post_message(
            channel=payload["channel"],
            text=payload["text"],
            author=payload["author"],
            idempotency_key=payload["idempotency_key"],
        )

    handlers: dict[str, Handler] = {
        Topic.REQUEST_SUBMIT: request_submit,
        Topic.REALTIME_PUBLISH: realtime_publish,
        Topic.KB_EMBED: kb_embed,
        Topic.MESSENGER_POST: messenger_post,
    }
    return handlers, {Topic.REQUEST_SUBMIT: request_dead}


class OutboxDispatcher:
    def __init__(
        self,
        db: Database,
        handlers: Mapping[str, Handler],
        *,
        batch_size: int,
        max_attempts: int,
        dead_handlers: Mapping[str, Handler] | None = None,
    ) -> None:
        self._db = db
        self._handlers = handlers
        self._dead_handlers = dead_handlers or {}
        self._batch_size = batch_size
        self._max_attempts = max_attempts

    async def run_once(self) -> int:
        """Deliver one batch. Returns how many events were taken, so the caller can idle when 0."""
        now = datetime.now(UTC)
        async with self._db.unit_of_work() as uow:
            events = await uow.outbox.claim_batch(limit=self._batch_size, now=now)
            for event in events:
                await self._deliver(event, now)
        return len(events)

    async def _deliver(self, event: OutboxEvent, now: datetime) -> None:
        handler = self._handlers.get(event.topic)
        if handler is None:
            await self._fail(event, now, f"no handler for topic {event.topic!r}", final=True)
            return

        event.attempts += 1
        try:
            await handler(event.payload)
        except Exception as exc:  # any handler failure is recorded and retried later
            await self._fail(event, now, repr(exc), final=event.attempts >= self._max_attempts)
            return
        event.status = OutboxStatus.DONE
        event.processed_at = now
        OUTBOX_EVENTS.labels(topic=event.topic, outcome="done").inc()

    async def _fail(self, event: OutboxEvent, now: datetime, error: str, *, final: bool) -> None:
        event.last_error = error[:_ERROR_TEXT_MAX]
        if not final:
            event.available_at = now + retry_delay(event.attempts)
            OUTBOX_EVENTS.labels(topic=event.topic, outcome="retry").inc()
            logger.warning("outbox event %s (%s) failed: %s", event.id, event.topic, error)
            return
        event.status = OutboxStatus.DEAD
        OUTBOX_EVENTS.labels(topic=event.topic, outcome="dead").inc()
        logger.error("outbox event %s (%s) is dead: %s", event.id, event.topic, error)
        on_dead = self._dead_handlers.get(event.topic)
        if on_dead is not None:
            try:
                await on_dead(event.payload)
            except Exception:  # the event is already dead; log and move on
                logger.exception("dead handler for %s failed", event.topic)
