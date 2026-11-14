"""Kafka adapter and a durable example sink, not Avito's actual Clickstream."""

import asyncio
import json
import logging
import sqlite3
from pathlib import Path
from uuid import UUID

from app.core.config import Settings
from app.domain.clickstream import AnalyticsEnvelope

logger = logging.getLogger(__name__)


class KafkaAnalyticsPublisher:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        # Lazy import/start: API and a worker with export disabled never contact Kafka.
        self._producer: object | None = None

    async def publish(self, event: AnalyticsEnvelope) -> None:
        from aiokafka import AIOKafkaProducer  # noqa: PLC0415 - optional runtime adapter

        if self._producer is None:
            producer = AIOKafkaProducer(
                bootstrap_servers=self._settings.kafka_bootstrap_servers,
                enable_idempotence=True,
                request_timeout_ms=int(self._settings.kafka_timeout_sec * 1000),
            )
            try:
                async with asyncio.timeout(self._settings.kafka_timeout_sec):
                    await producer.start()
            except BaseException:
                await producer.stop()
                raise
            self._producer = producer
        else:
            # The private field holds only AIOKafkaProducer; keep the import lazy.
            assert isinstance(self._producer, AIOKafkaProducer)  # noqa: S101
            producer = self._producer
        # Idempotent mode may retry indefinitely inside aiokafka; bound the handler wait
        # so a dead broker does not hold an outbox batch/DB transaction indefinitely.
        async with asyncio.timeout(self._settings.kafka_timeout_sec):
            await producer.send_and_wait(
                self._settings.kafka_analytics_topic,
                json.dumps(event, ensure_ascii=True, allow_nan=False).encode(),
                key=event["event_id"].encode(),
            )

    async def close(self) -> None:
        from aiokafka import AIOKafkaProducer  # noqa: PLC0415 - optional runtime adapter

        producer, self._producer = self._producer, None
        if isinstance(producer, AIOKafkaProducer):
            try:
                async with asyncio.timeout(self._settings.kafka_timeout_sec):
                    await producer.stop()
            except TimeoutError:
                logger.warning(
                    "Kafka producer shutdown timed out; unacknowledged events remain in outbox"
                )


class ClickstreamSink:
    """SQLite deduplication survives restarts. No actor or properties are stored/logged."""

    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(path)
        self._connection.execute(
            "CREATE TABLE IF NOT EXISTS events "
            "(event_id TEXT PRIMARY KEY, name TEXT NOT NULL, occurred_at TEXT NOT NULL)"
        )

    def store(self, value: bytes) -> bool:
        event = json.loads(value)
        if event.get("schema_version") != 1 or event.get("is_synthetic") is not True:
            raise ValueError("Only synthetic schema version 1 is accepted")
        event_id = str(UUID(event["event_id"]))
        with self._connection:
            cursor = self._connection.execute(
                "INSERT INTO events(event_id, name, occurred_at) VALUES (?, ?, ?) "
                "ON CONFLICT(event_id) DO NOTHING",
                (event_id, event["name"], event["occurred_at"]),
            )
        return cursor.rowcount == 1

    def close(self) -> None:
        self._connection.close()


async def consume(settings: Settings) -> None:
    from aiokafka import AIOKafkaConsumer  # noqa: PLC0415 - optional runtime adapter

    consumer = AIOKafkaConsumer(
        settings.kafka_analytics_topic,
        bootstrap_servers=settings.kafka_bootstrap_servers,
        group_id=settings.kafka_consumer_group,
        enable_auto_commit=False,
        auto_offset_reset="earliest",
    )
    sink = ClickstreamSink(settings.clickstream_sink_path)
    try:
        await consumer.start()
        while True:
            record = await consumer.getone()
            inserted = sink.store(record.value)
            # Durable local commit precedes Kafka offset commit. A crash between them
            # replays the same event_id, which SQLite safely ignores.
            await consumer.commit()
            logger.info("synthetic clickstream event: %s", "stored" if inserted else "duplicate")
    finally:
        sink.close()
        await consumer.stop()
