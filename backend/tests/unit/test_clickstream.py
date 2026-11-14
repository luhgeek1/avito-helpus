import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import ClassVar
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from pydantic import SecretStr, ValidationError

from app.domain.clickstream import envelope, safe_properties
from app.domain.events import AnalyticsEvent
from app.infra.clickstream import ClickstreamSink, KafkaAnalyticsPublisher, consume
from app.infra.observability import ensure_secret
from app.service.assistant.deps import TOOL_PERMISSIONS
from tests.conftest import build_settings


def wire_event(**overrides: object) -> dict:
    return (
        dict(
            envelope(
                event_id=uuid4(),
                name=AnalyticsEvent.ANSWER_FEEDBACK,
                occurred_at=datetime.now(UTC),
                user_id=uuid4(),
                properties={"rating": "up", "comment": "private text"},
                secret=b"test-key",
            )
        )
        | overrides
    )


def test_envelope_identity_privacy_and_secret_rotation() -> None:
    event_id, actor_id = uuid4(), uuid4()
    params = {
        "event_id": event_id,
        "name": AnalyticsEvent.CHAT_MESSAGE,
        "occurred_at": datetime.now(UTC),
        "user_id": actor_id,
        "properties": {
            "mode": "online",
            "email": "person@example.test",
            "tools": ["secret"],
            "text": "private text",
            "user_id": str(actor_id),
        },
    }
    first = envelope(**params, secret=b"first-key")
    assert first == envelope(**params, secret=b"first-key")
    assert first["actor"] != envelope(**params, secret=b"second-key")["actor"]
    assert (
        first["actor"] != envelope(**(params | {"user_id": uuid4()}), secret=b"first-key")["actor"]
    )
    assert first["event_id"] == str(event_id)
    assert first["properties"] == {"mode": "online"}
    assert len(first["actor"]) == 64
    assert str(actor_id) not in json.dumps(first)
    assert "private" not in json.dumps(first)
    assert first["schema_version"] == 1
    assert first["is_synthetic"] is True
    assert envelope(**(params | {"user_id": None}), secret=b"key")["actor"] is None
    assert envelope(**(params | {"name": "email@example.test"}), secret=b"key")["name"] == "unknown"
    for tool in TOOL_PERMISSIONS:
        assert safe_properties(AnalyticsEvent.TOOL_CALLED, {"tool": tool}) == {"tool": tool}


@pytest.mark.parametrize(
    ("name", "properties", "expected"),
    [
        (
            AnalyticsEvent.KNOWLEDGE_SEARCH,
            {"hits": 3, "conflicts": 1, "mode": "fts"},
            {"hits": 3, "conflicts": 1, "mode": "fts"},
        ),
        (
            AnalyticsEvent.KNOWLEDGE_SEARCH,
            {"hits": True, "conflicts": -1, "mode": "private@example.test"},
            {},
        ),
        (AnalyticsEvent.KNOWLEDGE_SEARCH, {"hits": 10001, "conflicts": "personal"}, {}),
        (
            AnalyticsEvent.ACTION_DECIDED,
            {"tool": "request_access", "decision": "approve"},
            {"tool": "request_access", "decision": "approve"},
        ),
        (
            AnalyticsEvent.ACTION_DECIDED,
            {"tool": "private@example.test", "decision": "free text"},
            {},
        ),
        (
            AnalyticsEvent.ESCALATION_ANSWERED,
            {"level": "mentor", "faq": True, "answer": "private"},
            {"level": "mentor", "faq": True},
        ),
        (AnalyticsEvent.ESCALATION_ANSWERED, {"faq": "private"}, {}),
        (AnalyticsEvent.PLAN_ITEM_DONE, {"slug": "private@example.test"}, {}),
        (
            AnalyticsEvent.UI_EVENT,
            {"name": "plan.opened", "url": "private"},
            {"name": "plan.opened"},
        ),
        (
            AnalyticsEvent.REQUEST_CREATED,
            {"kind": "access", "source": "agent"},
            {"kind": "access", "source": "agent"},
        ),
        (
            AnalyticsEvent.REQUEST_RESOLVED,
            {"status": "approved", "kind": "absence"},
            {"status": "approved", "kind": "absence"},
        ),
        (
            AnalyticsEvent.ANSWER_FEEDBACK,
            {"rating": "down", "comment": "private"},
            {"rating": "down"},
        ),
    ],
)
def test_properties_allowlist(name: str, properties: dict, expected: dict) -> None:
    assert safe_properties(name, properties) == expected


def test_export_settings_default_off_and_key_validation(tmp_path: Path) -> None:
    assert build_settings().analytics_export_key is None
    with pytest.raises(ValidationError, match="CLICKSTREAM_HMAC_KEY"):
        build_settings(clickstream_enabled=True)
    key = tmp_path / "secret"
    value = ensure_secret(key)
    assert ensure_secret(key) == value
    enabled = build_settings(clickstream_enabled=True, clickstream_hmac_key_path=key)
    assert enabled.analytics_export_key == value.encode()
    assert value not in repr(enabled)
    assert build_settings(clickstream_hmac_key=SecretStr(value)).analytics_export_key is None


def test_sink_deduplicates_across_restart_and_rejects_foreign_schema(tmp_path: Path) -> None:
    path = tmp_path / "nested" / "sink.sqlite3"
    event = wire_event()
    sink = ClickstreamSink(path)
    assert sink.store(json.dumps(event).encode()) is True
    assert sink.store(json.dumps(event).encode()) is False
    sink.close()
    restarted = ClickstreamSink(path)
    assert restarted.store(json.dumps(event).encode()) is False
    assert restarted.store(json.dumps(wire_event()).encode()) is True
    with pytest.raises(ValueError, match="synthetic schema"):
        restarted.store(json.dumps(event | {"is_synthetic": False}).encode())
    with pytest.raises(ValueError, match="synthetic schema"):
        restarted.store(json.dumps(event | {"schema_version": 2}).encode())
    restarted.close()


class FakeProducer:
    instances: ClassVar[list] = []
    fail_start = False
    fail_send = False
    slow_stop = False

    def __init__(self, **kwargs: object) -> None:
        self.kwargs = kwargs
        self.events: list[tuple] = []
        self.stopped = False
        self.instances.append(self)

    async def start(self) -> None:
        if self.fail_start:
            raise ConnectionError("test broker unavailable")

    async def send_and_wait(self, topic: str, value: bytes, *, key: bytes) -> None:
        if self.fail_send:
            await asyncio.sleep(1)
        self.events.append((topic, value, key))

    async def stop(self) -> None:
        self.stopped = True
        if self.slow_stop:
            await asyncio.sleep(1)


@pytest.fixture
def kafka_module(monkeypatch: pytest.MonkeyPatch) -> SimpleNamespace:
    FakeProducer.instances = []
    FakeProducer.fail_start = FakeProducer.fail_send = FakeProducer.slow_stop = False
    module = SimpleNamespace(AIOKafkaProducer=FakeProducer)
    monkeypatch.setitem(sys.modules, "aiokafka", module)
    return module


async def test_kafka_adapter_key_payload_and_lifecycle(kafka_module: SimpleNamespace) -> None:
    settings = build_settings()
    adapter = KafkaAnalyticsPublisher(settings)
    assert not FakeProducer.instances
    event = wire_event()
    await adapter.publish(event)
    await adapter.publish(event)
    producer = FakeProducer.instances[0]
    assert producer.kwargs["enable_idempotence"] is True
    assert len(FakeProducer.instances) == 1
    assert producer.events[0] == producer.events[1]
    topic, value, key = producer.events[0]
    assert topic == settings.kafka_analytics_topic
    assert json.loads(value) == event
    assert key == event["event_id"].encode()
    await adapter.close()
    assert producer.stopped
    await adapter.close()


async def test_kafka_start_failure_is_cleaned_and_retried(kafka_module: SimpleNamespace) -> None:
    adapter = KafkaAnalyticsPublisher(build_settings())
    FakeProducer.fail_start = True
    with pytest.raises(ConnectionError):
        await adapter.publish(wire_event())
    assert FakeProducer.instances[0].stopped
    FakeProducer.fail_start = False
    await adapter.publish(wire_event())
    assert len(FakeProducer.instances) == 2
    await adapter.close()


async def test_kafka_timeouts_bound_send_and_shutdown(kafka_module: SimpleNamespace) -> None:
    adapter = KafkaAnalyticsPublisher(build_settings(kafka_timeout_sec=0.01))
    FakeProducer.fail_send = True
    with pytest.raises(TimeoutError):
        await adapter.publish(wire_event())
    FakeProducer.slow_stop = True
    await adapter.close()
    assert FakeProducer.instances[0].stopped


async def test_consumer_commits_after_durable_store_and_deduplicates(
    kafka_module: SimpleNamespace,
    tmp_path: Path,
) -> None:
    event = json.dumps(wire_event()).encode()
    consumer = SimpleNamespace(
        start=AsyncMock(),
        stop=AsyncMock(),
        commit=AsyncMock(),
        getone=AsyncMock(
            side_effect=[
                SimpleNamespace(value=event),
                SimpleNamespace(value=event),
                asyncio.CancelledError(),
            ]
        ),
    )
    kafka_module.AIOKafkaConsumer = lambda *_args, **_kwargs: consumer
    path = tmp_path / "consumer.sqlite3"

    async def verify_stored() -> None:
        check = ClickstreamSink(path)
        assert check.store(event) is False
        check.close()

    consumer.commit.side_effect = verify_stored
    with pytest.raises(asyncio.CancelledError):
        await consume(build_settings(clickstream_sink_path=path))
    assert consumer.commit.await_count == 2
    consumer.stop.assert_awaited_once()


async def test_consumer_never_commits_invalid_event(
    kafka_module: SimpleNamespace,
    tmp_path: Path,
) -> None:
    consumer = SimpleNamespace(
        start=AsyncMock(),
        stop=AsyncMock(),
        commit=AsyncMock(),
        getone=AsyncMock(return_value=SimpleNamespace(value=b"{}")),
    )
    kafka_module.AIOKafkaConsumer = lambda *_args, **_kwargs: consumer
    with pytest.raises(ValueError, match="synthetic schema"):
        await consume(build_settings(clickstream_sink_path=tmp_path / "consumer.sqlite3"))
    consumer.commit.assert_not_awaited()
    consumer.stop.assert_awaited_once()
