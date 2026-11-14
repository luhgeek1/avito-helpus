import asyncio
import importlib
import json
import subprocess
import sys
import threading
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from app import worker
from app.api.schemas.base import MoscowDateTime, ResponseModel
from app.core.security import webhooks
from app.db.models import OutboxEvent
from app.domain.events import OutboxStatus, Topic
from app.service.outbox import OutboxDispatcher
from tests.conftest import build_settings


@pytest.mark.parametrize("timestamp", ["nan", "inf", "-inf", "1e999", "invalid"])
def test_webhook_rejects_non_finite_time(timestamp: str) -> None:
    assert not webhooks.verify(
        "secret",
        timestamp=timestamp,
        signature=webhooks.sign("secret", timestamp, b"{}"),
        body=b"{}",
        now=123,
        tolerance_sec=300,
    )


def test_webhook_rejects_unicode_signature_without_crashing() -> None:
    assert not webhooks.verify(
        "secret",
        timestamp="123",
        signature="подделка",
        body=b"{}",
        now=123,
        tolerance_sec=300,
    )


def test_api_datetimes_are_moscow() -> None:
    class TimestampOut(ResponseModel):
        created_at: MoscowDateTime

    result = TimestampOut(created_at=datetime(2026, 11, 14, 22, tzinfo=UTC)).model_dump(mode="json")
    assert result["created_at"] == "2026-11-15T01:00:00+03:00"
    schema = TimestampOut.model_json_schema(mode="serialization")
    assert schema["properties"]["created_at"]["format"] == "date-time"


async def test_dead_handler_failure_is_retried() -> None:
    now = datetime.now(UTC)
    event = OutboxEvent(
        id=uuid4(), topic=Topic.REQUEST_SUBMIT, payload={}, attempts=0, status=OutboxStatus.PENDING
    )
    handler = AsyncMock(side_effect=RuntimeError("offline"))
    dead = AsyncMock(side_effect=[RuntimeError("database offline"), None])
    dispatcher = OutboxDispatcher(
        Mock(),
        {Topic.REQUEST_SUBMIT: handler},
        batch_size=1,
        max_attempts=1,
        dead_handlers={Topic.REQUEST_SUBMIT: dead},
    )
    await dispatcher._handle(event, now)
    assert event.status is OutboxStatus.PENDING
    await dispatcher._handle(event, now)
    assert event.status is OutboxStatus.DEAD
    assert dead.await_count == 2


async def test_windows_worker_installs_fallback_signals(monkeypatch: pytest.MonkeyPatch) -> None:
    db = SimpleNamespace(dispose=AsyncMock())
    redis = SimpleNamespace(aclose=AsyncMock())
    monkeypatch.setattr(worker, "Database", Mock(return_value=db))
    monkeypatch.setattr(worker.Redis, "from_url", Mock(return_value=redis))
    monkeypatch.setattr(worker, "build_handlers", Mock(return_value=({}, {})))
    monkeypatch.setattr(worker, "maintenance_jobs", Mock(return_value=[]))
    monkeypatch.setattr(worker, "Nudges", Mock(return_value=SimpleNamespace(jobs=list)))
    monkeypatch.setattr(
        asyncio.get_running_loop(), "add_signal_handler", Mock(side_effect=NotImplementedError)
    )
    signals = Mock()
    monkeypatch.setattr(worker.signal, "signal", signals)
    monkeypatch.setattr(worker, "poll_outbox", AsyncMock())
    await worker.run_worker(build_settings(worker_metrics_enabled=False))
    assert signals.call_count == 2
    signals.call_args.args[1](None, None)


@pytest.fixture
def deploy_modules(monkeypatch: pytest.MonkeyPatch) -> SimpleNamespace:
    monkeypatch.syspath_prepend(str(Path(__file__).resolve().parents[3] / "deploy"))
    return SimpleNamespace(
        smoke=importlib.import_module("smoke"),
        load=importlib.import_module("loadtest"),
        http=importlib.import_module("http_client"),
        reset=importlib.import_module("reset_demo"),
    )


def test_smoke_http_400_cannot_pass(
    deploy_modules: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    client = Mock()
    client.login.return_value = client
    client.json.side_effect = [
        {"full_name": "Demo", "assistant_mode": "offline"},
        {"percent": 10, "next_steps": []},
        {"id": "conversation"},
    ]
    client.request.return_value = (400, b'{"detail":"bad request"}')
    monkeypatch.setattr(deploy_modules.smoke, "Client", Mock(return_value=client))
    with pytest.raises(RuntimeError, match="HTTP 400"):
        deploy_modules.smoke.main()


def test_smoke_missing_card_is_not_automatically_success(
    deploy_modules: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = Mock()
    client.login.return_value = client
    client.json.side_effect = [
        {"full_name": "Demo", "assistant_mode": "offline"},
        {"percent": 10, "next_steps": []},
        {"id": "conversation"},
        {"outcome": "ready"},
    ]
    client.request.return_value = (200, b'data: {"type":"finish"}\n\ndata: [DONE]\n\n')
    monkeypatch.setattr(deploy_modules.smoke, "Client", Mock(return_value=client))
    with pytest.raises(RuntimeError, match="Карточка"):
        deploy_modules.smoke.main()


def test_load_report_separates_chat_limits_and_errors(deploy_modules: SimpleNamespace) -> None:
    result = deploy_modules.load.summarize(
        {
            "POST chat message": [
                (200, 100, False),
                (429, 1, False),
                (500, 5, False),
                (200, 15, True),
                (0, 10, True),
            ]
        }
    )["POST chat message"]
    assert result["successful"] == 1
    assert result["rate_limited"] == 1
    assert result["errors"] == 3
    assert result["success_ms"]["p99"] == 100
    assert result["codes"]["transport"] == 1


def test_sse_error_is_detected(deploy_modules: SimpleNamespace) -> None:
    with pytest.raises(RuntimeError):
        deploy_modules.http.stream_parts(b'data: {"type":"error"}\n\n')
    with pytest.raises(RuntimeError):
        deploy_modules.http.stream_parts(b'data: {"type":"start"}\n\n')


def test_load_script_reports_every_operation(
    deploy_modules: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    class DemoClient:
        def __init__(self, *args, **kwargs):
            pass

        def login(self, *args):
            return self

        def close(self):
            pass

        def json(self, path, *args, **kwargs):
            return {"id": "demo"}

        def request(self, path, *args):
            if path.endswith("/messages"):
                return 200, b'data: {"type":"finish"}\n\ndata: [DONE]\n\n'
            return 200, b"{}"

    output = tmp_path / "load.json"
    monkeypatch.setattr(deploy_modules.load, "Client", DemoClient)
    monkeypatch.setattr(
        sys, "argv", ["loadtest", "--users", "2", "--duration", "0.02", "--output", str(output)]
    )
    assert deploy_modules.load.main() == 0
    report = json.loads(output.read_text(encoding="utf-8"))
    assert report["accounts"] == 10
    assert len(report["operations"]) == 6


def test_coordinated_reset_stops_producers_first(
    deploy_modules: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    compose = Mock()
    monkeypatch.setattr(deploy_modules.reset, "compose", compose)
    assert deploy_modules.reset.main() == 0
    assert compose.call_args_list[0].args == ("stop", "worker", "api")
    assert compose.call_args_list[1].args[:4] == ("run", "--rm", "--no-deps", "migrate")
    assert "seed" in compose.call_args_list[1].args
    assert "reset_sequence=true" in compose.call_args_list[2].args[-1]
    assert compose.call_args_list[-1].args == ("start", "api", "worker")


@pytest.mark.parametrize("failing_step", [1, 2])
def test_coordinated_reset_failure_keeps_producers_stopped(
    deploy_modules: SimpleNamespace,
    monkeypatch: pytest.MonkeyPatch,
    failing_step: int,
) -> None:
    calls = []

    def compose(*args):
        calls.append(args)
        if len(calls) == failing_step + 1:
            raise subprocess.CalledProcessError(1, ["docker", "compose", *args])

    monkeypatch.setattr(deploy_modules.reset, "compose", compose)
    with pytest.raises(subprocess.CalledProcessError):
        deploy_modules.reset.main()
    assert len(calls) == failing_step + 1
    assert all(call[0] != "start" for call in calls)


def test_http_client_reuses_connections_and_does_not_hide_errors(
    deploy_modules: SimpleNamespace,
) -> None:
    connections = []

    class Handler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def do_POST(self):
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            connections.append(self.client_address)
            assert self.headers.get("User-Agent") == "orbi-demo-check/1.0"
            payload = json.loads(body)
            if self.path.endswith("/auth/login"):
                assert payload["email"] == "demo@buddy.test"
                status, response = 200, b'{"access_token":"demo-token"}'
            else:
                assert self.headers["Authorization"] == "Bearer demo-token"
                status, response = 400, b'{"detail":"invalid request"}'
            self.send_response(status)
            self.send_header("Content-Length", str(len(response)))
            self.end_headers()
            self.wfile.write(response)

        def log_message(self, *args):
            pass

    with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        client = deploy_modules.http.Client(f"http://127.0.0.1:{server.server_port}")
        try:
            client.login("demo@buddy.test", "test-password")
            with pytest.raises(RuntimeError, match="HTTP 400"):
                client.json("/bad", {"text": "Проверка"})
            assert len(set(connections)) == 1
        finally:
            client.close()
            server.shutdown()
            thread.join(timeout=3)
