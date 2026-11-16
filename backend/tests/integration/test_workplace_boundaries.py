from datetime import timedelta
from typing import Any

from fastapi import FastAPI
from httpx import AsyncClient

from app.core.clock import today
from app.domain.absence import AbsenceType
from app.domain.events import Topic
from app.service.assistant.tools import check_absence, create_it_ticket
from app.service.assistant.workplace import control_request, my_calendar
from app.service.outbox import build_handlers
from tests.fakes import RecordingPublisher
from tests.integration.conftest import Account
from tests.integration.test_backend_boundaries import context
from tests.integration.test_chat_api import Chat, parse, parts, text_of


async def test_controls_reject_terminal_and_unsupported_requests(
    app: FastAPI, anya: Account
) -> None:
    ctx = await context(app, anya, approved=True)
    app.state.corp.unavailable = True
    created = await create_it_ticket(ctx, "Test", "Test issue")
    ref = created["request"]["id"]
    assert "только" not in (await control_request(ctx, "unknown", "cancel"))["message"]
    assert "Напомнить можно" in (await control_request(ctx, ref, "remind"))["message"]
    assert (await control_request(ctx, ref, "cancel"))["status"] == "cancelled"
    assert "уже есть решение" in (await control_request(ctx, ref, "cancel"))["message"]


async def test_calendar_limits_and_sick_preview(app: FastAPI, anya: Account) -> None:
    ctx = await context(app, anya)
    result = await my_calendar(ctx, today(), today() + timedelta(days=31))
    assert "до 31" in result["message"]
    assert "до 31" in (await my_calendar(ctx, today(), today() - timedelta(days=1)))["message"]
    result = await check_absence(ctx, AbsenceType.SICK_LEAVE, today(), today())
    assert "не списываются" in result["message"]
    assert result["warnings"]


async def test_reminder_cooldown_and_missing_reference(client: AsyncClient, anya: Account) -> None:
    chat = await Chat(client, anya).start()
    assert "Укажи номер" in text_of(await chat.say("Отмени заявку"))
    [card] = parts(await chat.say("Нужен доступ к listings-api"), "action")
    [request] = parts(parse((await chat.decide(card["id"])).text), "request")
    for _ in range(2):
        [card] = parts(await chat.say(f"Напомни о заявке {request['external_id']}"), "action")
        response = parse((await chat.decide(card["id"])).text)
    assert "20" in text_of(response) or "напомин" in text_of(response).lower()
    assert "встреч нет" in text_of(await chat.say(f"Мои встречи на {today():%d.%m.%Y}"))


async def test_failed_message_delivery_notifies_once(
    app: FastAPI,
    client: AsyncClient,
    anya: Account,
) -> None:
    _, dead = build_handlers(
        db=app.state.db,
        corp=app.state.corp,
        publisher=RecordingPublisher(),
        embeddings=None,
        settings=app.state.settings,
    )
    payload: dict[str, Any] = {"user_id": anya.id, "idempotency_key": "failed-message"}
    await dead[Topic.MESSENGER_POST](payload)
    await dead[Topic.MESSENGER_POST](payload)
    notes = (await client.get("/api/v1/notifications", headers=anya.headers)).json()["items"]
    assert len([n for n in notes if n["title"] == "Сообщение команде не доставлено"]) == 1
