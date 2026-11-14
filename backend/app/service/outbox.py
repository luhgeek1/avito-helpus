import logging
from collections.abc import Awaitable, Callable, Mapping
from datetime import UTC, datetime, timedelta
from time import perf_counter
from typing import Any, cast
from uuid import UUID

from app.core.config import Settings
from app.db.database import Database
from app.db.models import OutboxEvent
from app.domain.clickstream import AnalyticsEnvelope
from app.domain.corp import CorpRequestError
from app.domain.events import OutboxStatus, Topic
from app.infra.metrics import OUTBOX_DURATION, OUTBOX_EVENTS, metric_topic
from app.service.knowledge import KnowledgeService
from app.service.ports import AnalyticsPublisher, CorpServices, Embeddings, Publisher
from app.service.requests import deliver_control, fail_control, fail_request, submit_request

logger = logging.getLogger(__name__)

Handler = Callable[[dict[str, Any]], Awaitable[None]]

_MAX_RETRY_DELAY = timedelta(hours=1)
_ERROR_TEXT_MAX = 2000


def retry_delay(attempt: int) -> timedelta:
    """Exponential backoff: 2 s, 4 s, 8 s ... capped at one hour."""
    return min(timedelta(seconds=2 ** min(attempt, 12)), _MAX_RETRY_DELAY)


def build_handlers(
    *,
    db: Database,
    corp: CorpServices,
    publisher: Publisher,
    embeddings: Embeddings | None,
    settings: Settings,
    analytics: AnalyticsPublisher | None = None,
) -> tuple[dict[str, Handler], dict[str, Handler]]:
    """Handlers per topic, plus "dead" handlers that run once when retries are exhausted."""

    async def request_submit(payload: dict[str, Any]) -> None:
        await submit_request(db, corp, settings, UUID(payload["request_id"]))

    async def request_dead(payload: dict[str, Any]) -> None:
        await fail_request(db, corp, settings, UUID(payload["request_id"]))

    async def request_cancel(payload: dict[str, Any]) -> None:
        await deliver_control(db, corp, settings, UUID(payload["request_id"]), cancel=True)

    async def request_remind(payload: dict[str, Any]) -> None:
        await deliver_control(
            db,
            corp,
            settings,
            UUID(payload["request_id"]),
            cancel=False,
            idempotency_key=payload["idempotency_key"],
        )

    async def control_dead(payload: dict[str, Any]) -> None:
        await fail_control(db, UUID(payload["request_id"]))

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
        Topic.REQUEST_CANCEL: request_cancel,
        Topic.REQUEST_REMIND: request_remind,
        Topic.REALTIME_PUBLISH: realtime_publish,
        Topic.KB_EMBED: kb_embed,
        Topic.MESSENGER_POST: messenger_post,
    }
    if settings.clickstream_enabled and analytics is not None:

        async def analytics_publish(payload: dict[str, Any]) -> None:
            # Only OpsRepository creates this immutable, sanitized wire payload.
            await analytics.publish(cast(AnalyticsEnvelope, payload))

        handlers[Topic.ANALYTICS_PUBLISH] = analytics_publish
    return handlers, {
        Topic.REQUEST_SUBMIT: request_dead,
        Topic.REQUEST_CANCEL: control_dead,
        Topic.REQUEST_REMIND: control_dead,
    }


class OutboxDispatcher:
    def __init__(
        self,
        db: Database,
        handlers: Mapping[str, Handler],
        *,
        batch_size: int,
        max_attempts: int,
        dead_handlers: Mapping[str, Handler] | None = None,
        deferred_topics: tuple[Topic, ...] = (),
        only_topics: tuple[Topic, ...] = (),
    ) -> None:
        self._db = db
        self._handlers = handlers
        self._dead_handlers = dead_handlers or {}
        self._batch_size = batch_size
        self._max_attempts = max_attempts
        self._deferred_topics = deferred_topics
        self._only_topics = only_topics

    async def run_once(self) -> int:
        """Deliver one batch. Returns how many events were taken, so the caller can idle when 0."""
        now = datetime.now(UTC)
        async with self._db.unit_of_work() as uow:
            events = await uow.outbox.claim_batch(
                limit=self._batch_size,
                now=now,
                exclude_topics=self._deferred_topics,
                only_topics=self._only_topics,
            )
            for event in events:
                await self._deliver(event, now)
        return len(events)

    async def _deliver(self, event: OutboxEvent, now: datetime) -> None:
        started = perf_counter()
        try:
            await self._handle(event, now)
        finally:
            OUTBOX_DURATION.labels(topic=metric_topic(event.topic)).observe(
                perf_counter() - started
            )

    async def _handle(self, event: OutboxEvent, now: datetime) -> None:
        handler = self._handlers.get(event.topic)
        if handler is None:
            await self._fail(event, now, f"no handler for topic {event.topic!r}", final=True)
            return

        event.attempts += 1
        try:
            await handler(event.payload)
        except CorpRequestError as exc:
            await self._fail(event, now, repr(exc), final=True)
            return
        except Exception as exc:  # any handler failure is recorded and retried later
            await self._fail(
                event,
                now,
                repr(exc),
                final=event.topic != Topic.ANALYTICS_PUBLISH
                and event.attempts >= self._max_attempts,
            )
            return
        event.status = OutboxStatus.DONE
        event.processed_at = now
        event.last_error = None
        OUTBOX_EVENTS.labels(topic=metric_topic(event.topic), outcome="done").inc()

    async def _fail(self, event: OutboxEvent, now: datetime, error: str, *, final: bool) -> None:
        event.last_error = error[:_ERROR_TEXT_MAX]
        if not final:
            event.available_at = now + retry_delay(event.attempts)
            OUTBOX_EVENTS.labels(topic=metric_topic(event.topic), outcome="retry").inc()
            logger.warning("outbox event %s (%s) failed: %s", event.id, event.topic, error)
            return
        on_dead = self._dead_handlers.get(event.topic)
        if on_dead is not None:
            try:
                await on_dead(event.payload)
            except Exception:
                # The user's failure status/notification is part of delivery, too.
                event.available_at = now + retry_delay(event.attempts)
                OUTBOX_EVENTS.labels(topic=metric_topic(event.topic), outcome="retry").inc()
                logger.exception("dead handler for %s failed", event.topic)
                return
        event.status = OutboxStatus.DEAD
        OUTBOX_EVENTS.labels(topic=metric_topic(event.topic), outcome="dead").inc()
        logger.error("outbox event %s (%s) is dead: %s", event.id, event.topic, error)
