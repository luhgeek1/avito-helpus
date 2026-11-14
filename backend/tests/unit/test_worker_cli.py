import asyncio
import sys
from contextlib import nullcontext
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app import cli, worker
from app.domain.events import Topic
from tests.conftest import build_settings


@pytest.mark.parametrize("enabled", [False, True])
async def test_worker_isolates_export_and_cleans_resources(
    enabled: bool,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = build_settings(clickstream_enabled=enabled, clickstream_hmac_key="x" * 32)
    db = SimpleNamespace(dispose=AsyncMock())
    redis = SimpleNamespace(aclose=AsyncMock())
    exporter = SimpleNamespace(close=AsyncMock())
    monkeypatch.setattr(worker, "Database", Mock(return_value=db))
    monkeypatch.setattr(worker.Redis, "from_url", Mock(return_value=redis))
    monkeypatch.setattr(worker, "KafkaAnalyticsPublisher", Mock(return_value=exporter))
    monkeypatch.setattr(worker, "build_handlers", Mock(return_value=({}, {})))
    monkeypatch.setattr(worker, "maintenance_jobs", Mock(return_value=[]))
    monkeypatch.setattr(worker, "Nudges", Mock(return_value=SimpleNamespace(jobs=list)))
    monkeypatch.setattr(worker, "worker_metrics_server", Mock(return_value=nullcontext()))
    monkeypatch.setattr(worker, "refresh_outbox_metrics", AsyncMock(return_value=0))
    monkeypatch.setattr(asyncio.get_running_loop(), "add_signal_handler", Mock())
    dispatchers = Mock()
    monkeypatch.setattr(worker, "OutboxDispatcher", dispatchers)

    async def poll(_dispatcher: object, _stop: object, _interval: float, **kwargs: object) -> None:
        for job in kwargs.get("jobs", []):
            assert await job.run() == 0
        await asyncio.sleep(0)

    polling = AsyncMock(side_effect=poll)
    monkeypatch.setattr(worker, "poll_outbox", polling)
    await worker.run_worker(settings)
    assert dispatchers.call_args_list[0].kwargs["deferred_topics"] == (Topic.ANALYTICS_PUBLISH,)
    assert dispatchers.call_count == (2 if enabled else 1)
    if enabled:
        assert dispatchers.call_args_list[1].kwargs["only_topics"] == (Topic.ANALYTICS_PUBLISH,)
        exporter.close.assert_awaited_once()
    else:
        exporter.close.assert_not_awaited()
    redis.aclose.assert_awaited_once()
    db.dispose.assert_awaited_once()


@pytest.mark.parametrize(("reset", "counts"), [(False, {}), (True, {"users": 7})])
async def test_seed_cli_cleanup(reset: bool, counts: dict, monkeypatch: pytest.MonkeyPatch) -> None:
    db = SimpleNamespace(dispose=AsyncMock())
    monkeypatch.setattr(cli, "_SeedSettings", Mock(return_value=object()))
    monkeypatch.setattr(cli, "Database", Mock(return_value=db))
    seed = AsyncMock(return_value=counts)
    monkeypatch.setattr(cli, "seed", seed)
    result = await cli.run_seed(reset=reset)
    assert ("seeded:" if counts else "already seeded") in result
    seed.assert_awaited_once_with(db, reset=reset)
    db.dispose.assert_awaited_once()


async def test_observability_cli_cleans_db_on_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    db = SimpleNamespace(dispose=AsyncMock())
    monkeypatch.setattr(cli, "_SeedSettings", Mock(return_value=object()))
    monkeypatch.setattr(cli, "Database", Mock(return_value=db))
    monkeypatch.setattr(
        cli, "provision_grafana", AsyncMock(side_effect=RuntimeError("test failure"))
    )
    with pytest.raises(RuntimeError, match="test failure"):
        await cli.run_observability(Path("test"))
    db.dispose.assert_awaited_once()


@pytest.mark.parametrize(
    "command", ["keys", "seed", "telemetry-keys", "observability-init", "clickstream-consume"]
)
def test_cli_dispatch(command: str, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    args = ["cli", command]
    if command in {"keys", "telemetry-keys", "observability-init"}:
        args += ["--dir", str(tmp_path)]
    monkeypatch.setattr(sys, "argv", args)
    monkeypatch.setattr(cli, "run_seed", AsyncMock(return_value="already seeded"))
    monitoring = AsyncMock()
    consumer = AsyncMock()
    monkeypatch.setattr(cli, "run_observability", monitoring)
    monkeypatch.setattr(cli, "consume", consumer)
    monkeypatch.setattr(cli, "get_settings", build_settings)
    cli.main()
    if command == "keys":
        assert (tmp_path / "jwt_private_key.pem").exists()
    elif command == "telemetry-keys":
        assert len((tmp_path / "clickstream_hmac_key").read_text()) == 64
    elif command == "observability-init":
        monitoring.assert_awaited_once_with(tmp_path)
    elif command == "clickstream-consume":
        consumer.assert_awaited_once()
