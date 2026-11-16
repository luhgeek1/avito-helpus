from datetime import timedelta

from httpx import AsyncClient

from app.core.clock import today
from tests.fakes import FakeCorpServices, meeting
from tests.integration.conftest import ANYA, Account
from tests.integration.test_chat_api import Chat, parse, parts, text_of


async def test_sick_notice_requires_confirmation_and_omits_medical_fields(
    client: AsyncClient,
    anya: Account,
    corp: FakeCorpServices,
) -> None:
    chat = await Chat(client, anya).start()
    day = today().strftime("%d.%m.%Y")
    corp.balances[ANYA] = 0
    proposed = await chat.say(f"Оформи уведомление о больничном с {day} по {day}")
    [card] = parts(proposed, "action")
    fields = card["card"]["fields"]
    assert not any(field["editable"] for field in fields)
    assert any(field["value"] == "Не списываются" for field in fields)
    assert "absence_create" not in corp.calls
    approved = parse((await chat.decide(card["id"])).text)
    assert parts(approved, "request")[0]["status"] == "submitted"
    assert "написать команде" not in text_of(approved)


async def test_vacation_still_checks_balance_before_confirming(
    client: AsyncClient,
    anya: Account,
    corp: FakeCorpServices,
) -> None:
    day = today() + timedelta(days=14)
    while day.weekday() >= 5:
        day += timedelta(days=1)
    chat = await Chat(client, anya).start()
    proposed = await chat.say(f"Оформи отпуск {day:%d.%m.%Y}")
    assert parts(proposed, "action")
    assert "absence_balance" in corp.calls
    assert "absence_create" not in corp.calls


async def test_reminder_and_cancel_are_confirmed_and_scoped_to_owner(
    client: AsyncClient,
    anya: Account,
    kirill: Account,
) -> None:
    chat = await Chat(client, anya).start()
    [card] = parts(await chat.say("Нужен доступ к listings-api"), "action")
    [request] = parts(parse((await chat.decide(card["id"])).text), "request")
    ref = request["external_id"]
    stranger = await Chat(client, kirill).start()
    assert "Не нашёл" in text_of(await stranger.say(f"Отмени заявку {ref}"))
    for verb in ("Напомни о", "Отмени"):
        [control] = parts(await chat.say(f"{verb} заявку {ref}"), "action")
        assert control["card"]["kind"] == "request_control"
        answer = await chat.decide(control["id"])
        assert "error" not in [chunk["type"] for chunk in parse(answer.text)]
    result = (await client.get(f"/api/v1/requests/{request['id']}", headers=anya.headers)).json()
    assert result["payload"]["cancel_requested"] is True


async def test_calendar_reads_only_the_requested_period_and_handles_outages(
    client: AsyncClient,
    anya: Account,
    corp: FakeCorpServices,
) -> None:
    chat = await Chat(client, anya).start()
    assert "встреч нет" in text_of(await chat.say("Покажи мои встречи"))
    corp.events = [
        meeting("Встреча с наставником", today()),
        meeting("Позже", today() + timedelta(days=10)),
    ]
    answer = text_of(await chat.say("Какие встречи на неделе?"))
    assert "Встреча с наставником" in answer
    assert "15:00" in answer
    assert "МСК" in answer
    assert "Позже" not in answer
    corp.unavailable = True
    assert "недоступен" in text_of(await chat.say("Мой календарь"))
