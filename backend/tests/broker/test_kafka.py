"""Opt-in network proof. Install optional runner: uv run --with testcontainers[kafka]."""

import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest

from app.domain.clickstream import envelope
from app.domain.events import AnalyticsEvent
from app.infra.clickstream import ClickstreamSink, KafkaAnalyticsPublisher
from tests.conftest import build_settings

pytestmark = pytest.mark.broker


async def test_real_kafka_delivery_and_deduplication(tmp_path: Path) -> None:
    kafka = pytest.importorskip("testcontainers.kafka")
    aiokafka = pytest.importorskip("aiokafka")
    # Testcontainers' Python adapter configures Confluent's entrypoint. The prototype
    # itself uses the official Apache image; the wire protocol is the same.
    with kafka.KafkaContainer("confluentinc/cp-kafka:7.6.0").with_kraft() as broker:
        topic = f"orbi-test-{uuid4().hex}"
        settings = build_settings(
            kafka_bootstrap_servers=broker.get_bootstrap_server(),
            kafka_analytics_topic=topic,
            kafka_timeout_sec=20,
        )
        consumer = aiokafka.AIOKafkaConsumer(
            topic,
            bootstrap_servers=settings.kafka_bootstrap_servers,
            group_id=f"test-{uuid4().hex}",
            enable_auto_commit=False,
            auto_offset_reset="earliest",
        )
        producer = KafkaAnalyticsPublisher(settings)
        event = envelope(
            event_id=uuid4(),
            name=AnalyticsEvent.ANSWER_FEEDBACK,
            occurred_at=datetime.now(UTC),
            user_id=uuid4(),
            properties={"rating": "up"},
            secret=b"test-key",
        )
        sink = ClickstreamSink(tmp_path / "sink.sqlite3")
        try:
            await consumer.start()
            await producer.publish(event)
            await producer.publish(event)
            for inserted in [True, False]:
                record = await asyncio.wait_for(consumer.getone(), timeout=30)
                assert record.key == event["event_id"].encode()
                assert json.loads(record.value) == event
                assert sink.store(record.value) is inserted
                await consumer.commit()
        finally:
            await producer.close()
            await consumer.stop()
            sink.close()
