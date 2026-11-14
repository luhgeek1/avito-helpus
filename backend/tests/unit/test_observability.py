import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from prometheus_client import REGISTRY

from app.api.middleware import RequestContextMiddleware
from app.db.models import OutboxEvent
from app.domain.events import OutboxStatus, Topic
from app.infra.metrics import metric_job, metric_topic, render, worker_metrics_server
from app.service.nudges import ScheduledJob, run_due
from app.service.observability import refresh_outbox_metrics
from app.service.outbox import OutboxDispatcher, build_handlers
from app.worker import poll_outbox
from tests.conftest import build_settings
from tests.fakes import FakeCorpServices, RecordingPublisher
from tests.unit.test_clickstream import wire_event


def sample(name: str, **labels: str) -> float:
    return REGISTRY.get_sample_value(name, labels) or 0


def test_metrics_server_lifecycle_and_disabled_flag(monkeypatch: pytest.MonkeyPatch) -> None:
    server, thread = Mock(), Mock()
    start = Mock(return_value=(server, thread))
    monkeypatch.setattr("app.infra.metrics.start_http_server", start)
    with worker_metrics_server(enabled=False, host="127.0.0.1", port=9100):
        start.assert_not_called()
    with (
        pytest.raises(RuntimeError),
        worker_metrics_server(enabled=True, host="127.0.0.1", port=9101),
    ):
        raise RuntimeError("test shutdown")
    start.assert_called_once_with(9101, addr="127.0.0.1")
    server.shutdown.assert_called_once()
    server.server_close.assert_called_once()
    thread.join.assert_called_once()


@asynccontextmanager
async def fake_uow(rows: list):
    yield SimpleNamespace(outbox=SimpleNamespace(backlog=AsyncMock(return_value=rows)))


async def test_backlog_metrics_bounded_labels_and_reset() -> None:
    now = datetime.now(UTC)
    rows = [
        (Topic.ANALYTICS_PUBLISH, OutboxStatus.PENDING, 2, now - timedelta(seconds=40)),
        (Topic.ANALYTICS_PUBLISH, OutboxStatus.DEAD, 1, now - timedelta(seconds=50)),
        ("private1", OutboxStatus.DEAD, 2, now - timedelta(seconds=10)),
        ("private2", OutboxStatus.DEAD, 3, now + timedelta(seconds=10)),
    ]
    db = SimpleNamespace(unit_of_work=lambda: fake_uow(rows))
    assert await refresh_outbox_metrics(db, now) == 4
    assert sample("buddy_outbox_backlog", topic=Topic.ANALYTICS_PUBLISH, state="pending") == 2
    assert sample("buddy_outbox_backlog", topic="other", state="failed") == 5
    assert sample("buddy_outbox_oldest_seconds", topic=Topic.ANALYTICS_PUBLISH) == 50
    assert sample("buddy_outbox_snapshot_timestamp_seconds") == now.timestamp()
    rows.clear()
    await refresh_outbox_metrics(db, now)
    assert sample("buddy_outbox_backlog", topic="other", state="failed") == 0
    assert sample("buddy_outbox_oldest_seconds", topic=Topic.ANALYTICS_PUBLISH) == 0
    payload, content_type = render()
    assert b"buddy_outbox" in payload
    assert "text/plain" in content_type
    assert metric_topic("private-name") == metric_job("private-name") == "other"
    assert metric_job("reconcile") == "reconcile"


async def test_job_metrics_count_success_failure_duration_and_items() -> None:
    now = datetime.now(UTC)
    labels = {"task": "reconcile", "outcome": "ok"}
    before = sample("buddy_worker_jobs_total", **labels)
    jobs = [
        ScheduledJob("reconcile", timedelta(seconds=1), AsyncMock(return_value=3)),
        ScheduledJob("unknown", timedelta(seconds=1), AsyncMock(side_effect=RuntimeError)),
    ]
    await run_due(jobs, {}, now)
    assert sample("buddy_worker_jobs_total", **labels) == before + 1
    assert sample("buddy_worker_job_items_total", task="reconcile") >= 3
    assert sample("buddy_worker_jobs_total", task="other", outcome="error") >= 1
    assert sample("buddy_worker_job_seconds_count", task="reconcile") >= 1


async def test_analytics_handler_success_retry_and_stable_event_id() -> None:
    exporter = SimpleNamespace(
        publish=AsyncMock(side_effect=[ConnectionError("offline"), None]), close=AsyncMock()
    )
    settings = build_settings(clickstream_enabled=True, clickstream_hmac_key="x" * 32)
    handlers, _ = build_handlers(
        db=None,
        corp=FakeCorpServices(),
        publisher=RecordingPublisher(),
        embeddings=None,
        settings=settings,
        analytics=exporter,
    )
    disabled, _ = build_handlers(
        db=None,
        corp=FakeCorpServices(),
        publisher=RecordingPublisher(),
        embeddings=None,
        settings=build_settings(),
        analytics=exporter,
    )
    assert Topic.ANALYTICS_PUBLISH not in disabled
    dispatcher = OutboxDispatcher(None, handlers, batch_size=1, max_attempts=1)
    now = datetime.now(UTC)
    event = OutboxEvent(
        id=uuid4(),
        topic=Topic.ANALYTICS_PUBLISH,
        payload=wire_event(),
        attempts=100,
        status=OutboxStatus.PENDING,
    )
    await dispatcher._deliver(event, now)
    assert event.status == OutboxStatus.PENDING
    assert event.available_at == now + timedelta(hours=1)
    assert event.last_error
    assert "offline" in event.last_error
    await dispatcher._deliver(event, now + timedelta(hours=1))
    assert event.status == OutboxStatus.DONE
    assert event.last_error is None
    first, second = exporter.publish.await_args_list
    assert first.args[0]["event_id"] == second.args[0]["event_id"]
    assert sample("buddy_outbox_processing_seconds_count", topic=Topic.ANALYTICS_PUBLISH) >= 2


@pytest.mark.parametrize("processed", [0, 1, None])
async def test_poll_loop_survives_db_blip_and_stops(processed: int | None) -> None:
    stop = asyncio.Event()
    calls = 0

    async def run() -> int:
        nonlocal calls
        calls += 1
        if calls == 2:
            stop.set()
            return 0
        if processed is None:
            raise ConnectionError("temporary database issue")
        return processed

    await poll_outbox(SimpleNamespace(run_once=run), stop, 0.001)
    assert calls == 2


@pytest.mark.parametrize("cancelled", [False, True])
async def test_sse_gauge_increments_and_recovers_on_disconnect(cancelled: bool) -> None:
    route = "/api/v1/events"
    before = sample("buddy_sse_active_connections", route=route)

    async def app(scope: dict, receive: object, send: object) -> None:
        scope["route"] = SimpleNamespace(path=route)
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", b"text/event-stream; charset=utf-8")],
            }
        )
        assert sample("buddy_sse_active_connections", route=route) == before + 1
        if cancelled:
            raise asyncio.CancelledError()
        await send({"type": "http.response.body", "body": b"data: test\n\n", "more_body": False})

    middleware = RequestContextMiddleware(app)
    scope = {"type": "http", "method": "GET", "path": route, "headers": []}
    if cancelled:
        with pytest.raises(asyncio.CancelledError):
            await middleware(scope, AsyncMock(), AsyncMock())
    else:
        await middleware(scope, AsyncMock(), AsyncMock())
    assert sample("buddy_sse_active_connections", route=route) == before
