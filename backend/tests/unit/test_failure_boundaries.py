"""Contracts at infrastructure boundaries, using local fakes and no external models."""

import asyncio
import json
import logging
import sys
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from httpx import ASGITransport, AsyncClient
from pydantic_ai import ModelResponse, TextPart
from pydantic_ai.models.function import FunctionModel
from redis.exceptions import ConnectionError as RedisConnectionError

from app import worker
from app.api.middleware import RequestContextMiddleware
from app.api.problems import register_exception_handlers
from app.core.logging import JsonFormatter
from app.domain.absence import AbsenceType, _month, evaluate_absence, parse_dates_ru
from app.domain.corp import CorpUnavailableError
from app.infra import corp_mcp, llm
from app.infra.bus import RedisPublisher
from app.infra.rate_limit import RateLimiter
from app.service.assistant import offline
from app.service.assistant.tools import days_ru
from tests.conftest import build_settings


def test_json_log_retains_exception_and_request_id() -> None:
    try:
        raise ValueError("test failure")
    except ValueError:
        record = logging.makeLogRecord(
            {
                "msg": "failed %s",
                "args": ("job",),
                "levelname": "ERROR",
                "exc_info": sys.exc_info(),
                "request_id": "req-1",
            }
        )
    payload = json.loads(JsonFormatter().format(record))
    assert payload["message"] == "failed job"
    assert payload["request_id"] == "req-1"
    assert "ValueError: test failure" in payload["exc"]


async def test_non_http_scope_is_forwarded_without_request_headers() -> None:
    downstream = AsyncMock()
    scope = {"type": "lifespan"}
    receive, send = AsyncMock(), AsyncMock()
    await RequestContextMiddleware(downstream)(scope, receive, send)
    downstream.assert_awaited_once_with(scope, receive, send)


@pytest.mark.parametrize("debug", [False, True])
async def test_unhandled_error_is_problem_without_production_details(debug: bool) -> None:
    from fastapi import FastAPI  # noqa: PLC0415 - isolated application

    app = FastAPI()
    register_exception_handlers(app, debug=debug)

    @app.get("/broken")
    async def broken() -> None:
        raise RuntimeError("private diagnostic")

    async with AsyncClient(
        transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
    ) as client:
        response = await client.get("/broken")
    assert response.status_code == 500
    assert response.headers["content-type"] == "application/problem+json"
    assert response.json()["error_code"] == "INTERNAL_ERROR"
    assert ("private diagnostic" in response.json()["detail"]) is debug


async def test_redis_publish_failure_keeps_notifications_readable() -> None:
    redis = SimpleNamespace(publish=AsyncMock(side_effect=RedisConnectionError("down")))
    await RedisPublisher(redis).publish("user", "event", {"text": "Привет"})
    redis.publish.assert_awaited_once()


async def test_rate_limit_fails_open_on_redis_outage() -> None:
    redis = SimpleNamespace(pipeline=Mock(side_effect=RedisConnectionError("down")))
    assert await RateLimiter(redis, limit=1, window_sec=60).hit("test")


async def test_mcp_timeout_and_structured_plain_values(monkeypatch: pytest.MonkeyPatch) -> None:
    class SlowClient:
        def __init__(self, target):
            pass

        async def __aenter__(self):
            await asyncio.sleep(1)

        async def __aexit__(self, *args):
            return False

    monkeypatch.setattr(corp_mcp, "Client", SlowClient)
    with pytest.raises(CorpUnavailableError, match="timed out"):
        await corp_mcp.McpCorpServices("memory://test", timeout_sec=0.001).absence_balance(
            employee="test@buddy.test"
        )
    assert corp_mcp._structured(None) == {}
    assert corp_mcp._structured({"result": {"days_left": 5}}) == {"days_left": 5}
    assert corp_mcp._structured({"days_left": 5}) == {"days_left": 5}


async def test_embedding_adapter_preserves_vectors_and_batch_order(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    embedder = SimpleNamespace(
        embed_query=AsyncMock(return_value=SimpleNamespace(embeddings=[[1.0, 2.0]])),
        embed_documents=AsyncMock(return_value=SimpleNamespace(embeddings=[[1.0], [2.0]])),
    )
    monkeypatch.setattr(llm, "Embedder", Mock(return_value=embedder))
    adapter = llm.OpenAIEmbeddings(build_settings())
    assert await adapter.embed_query("question") == [1.0, 2.0]
    assert await adapter.embed_documents(("first", "second")) == [[1.0], [2.0]]
    embedder.embed_documents.assert_awaited_once_with(["first", "second"])


@pytest.mark.parametrize(("text", "expected"), [("  ответ  ", "ответ"), ("   ", None)])
async def test_background_generation_strips_or_discards_empty_output(text, expected) -> None:
    model = FunctionModel(lambda _messages, _info: ModelResponse(parts=[TextPart(text)]))
    assert (
        await llm.LlmTextGenerator(model, timeout_sec=1).generate("rules", "question") == expected
    )


async def test_worker_main_uses_settings_and_poll_survives_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stop = asyncio.Event()
    dispatcher = SimpleNamespace(run_once=AsyncMock(side_effect=[RuntimeError("DB"), 0]))

    async def jobs(*args):
        stop.set()

    monkeypatch.setattr(worker, "run_due", jobs)
    await worker.poll_outbox(dispatcher, stop, 0.001)
    assert dispatcher.run_once.await_count == 2


@pytest.mark.parametrize(
    ("count", "expected"),
    [
        (1, "1 день"),
        (2, "2 дня"),
        (11, "11 дней"),
        (14, "14 дней"),
        (21, "21 день"),
        (25, "25 дней"),
    ],
)
def test_russian_balance_units(count: int, expected: str) -> None:
    assert days_ru(count) == expected


def test_date_boundaries_and_long_absence_warning() -> None:
    assert _month("неизвестно") is None
    assert parse_dates_ru("20.11.26", date(2026, 11, 15)) == (date(2026, 11, 20),) * 2
    assert parse_dates_ru("31.02", date(2026, 11, 15)) is None
    check = evaluate_absence(
        type_=AbsenceType.DAY_OFF,
        start=date(2026, 11, 16),
        end=date(2026, 11, 20),
        today=date(2026, 11, 1),
        internship_start=None,
        balance=10,
        events=[],
    )
    assert check.working_days == 5
    assert any("Больше 3 дней" in warning for warning in check.warnings)


def test_offline_fallbacks_without_tools() -> None:
    day = date(2026, 11, 15)
    assert offline.route("непонятно", set(), day).tool is None
    assert "Пока не умею" in offline.route("непонятно", set(), day).text
    assert offline.route("выгорание", set(), day).tool is None
    assert offline._after("вопрос", "missing") == "вопрос"
    assert offline._user_prompt([]) == ""
    assert offline._summarize([]) == "Готово."


def test_leap_day_after_february_does_not_crash() -> None:
    assert parse_dates_ru("отгул 29.02", date(2028, 3, 1)) == (date(2032, 2, 29),) * 2


def test_private_tool_output_never_escalates_foreign_personal_data() -> None:
    from pydantic_ai import ModelRequest, ToolReturnPart, UserPromptPart  # noqa: PLC0415

    question = "Какая зарплата у коллеги?"
    messages = [ModelRequest(parts=[UserPromptPart(question)])]
    result = offline._follow_up(
        [ToolReturnPart("search_knowledge", {"sensitive": "compensation"}, "call")],
        {"ask_mentor"},
        messages,
    )
    assert result is None
