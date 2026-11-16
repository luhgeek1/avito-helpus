from datetime import timedelta

from httpx import AsyncClient

from app.core.clock import today
from tests.fakes import FakeCorpServices
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
