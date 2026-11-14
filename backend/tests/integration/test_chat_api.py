import json
from collections.abc import AsyncIterator
from dataclasses import replace
from datetime import timedelta
from typing import Any

from fastapi import FastAPI
from httpx import AsyncClient
from pydantic_ai import ModelMessage, ModelResponse
from pydantic_ai.exceptions import ModelHTTPError
from pydantic_ai.models.fallback import FallbackModel
from pydantic_ai.models.function import AgentInfo, FunctionModel
from sqlalchemy import update

from app.core.clock import today
from app.db.database import Database
from app.db.models import PendingAction
from app.service.assistant.offline import build_offline_model
from tests.fakes import FakeCorpServices
from tests.integration.conftest import ANYA, Account, AppFactory, login


def parse(stream: str) -> list[dict[str, Any]]:
    chunks = [json.loads(line[6:]) for line in stream.splitlines() if line.startswith("data: {")]
    assert stream.rstrip().endswith("data: [DONE]")
    return chunks


def text_of(chunks: list[dict[str, Any]]) -> str:
    return "".join(c["delta"] for c in chunks if c["type"] == "text-delta")


def parts(chunks: list[dict[str, Any]], kind: str) -> list[dict[str, Any]]:
    return [c["data"] for c in chunks if c["type"] == f"data-{kind}"]


class Chat:
    def __init__(self, client: AsyncClient, account: Account) -> None:
        self.client = client
        self.account = account
        self.id = ""

    async def start(self) -> "Chat":
        response = await self.client.post(
            "/api/v1/chat/conversations", headers=self.account.headers
        )
        assert response.status_code == 201
        self.id = response.json()["id"]
        return self

    async def say(self, text: str) -> list[dict[str, Any]]:
        response = await self.client.post(
            f"/api/v1/chat/conversations/{self.id}/messages",
            json={"text": text},
            headers=self.account.headers,
        )
        assert response.status_code == 200, response.text
        assert response.headers["x-vercel-ai-ui-message-stream"] == "v1"
        return parse(response.text)

    async def decide(self, action_id: str, decision: str = "approve", **edits: Any) -> Any:
        return await self.client.post(
            f"/api/v1/chat/conversations/{self.id}/actions/{action_id}",
            json={"decision": decision, "edits": edits},
            headers=self.account.headers,
        )


async def test_greeting_streams_text(client: AsyncClient, anya: Account) -> None:
    chunks = await (await Chat(client, anya).start()).say("Привет!")

    assert chunks[0]["type"] == "start"
    assert chunks[0]["messageMetadata"] == {"mode": "offline"}
    assert text_of(chunks).startswith("Привет! Я Орби")
    assert chunks[-1]["type"] == "finish"


async def test_access_request_through_the_chat(
    client: AsyncClient, anya: Account, corp: FakeCorpServices
) -> None:
    chat = await Chat(client, anya).start()
    proposed = await chat.say("Нужен доступ к репозиторию listings-api")
    [card] = parts(proposed, "action")
    assert card["status"] == "pending"
    assert card["card"]["service"] == "Сервис доступов"
    assert "проверь карточку" in text_of(proposed)
    assert "access_create" not in corp.calls  # nothing is sent before approval

    approved = await chat.decide(card["id"], justification="Задача LST-1432 про цены")
    chunks = parse(approved.text)
    [request] = parts(chunks, "request")
    assert request["status"] == "submitted"
    assert request["external_id"] == "ACC-1042"
    assert "ACC-1042" in text_of(chunks)

    twice = await chat.decide(card["id"])
    assert twice.status_code == 409
    assert twice.json()["error_code"] == "ACTION_ALREADY_DECIDED"

    history = (
        await client.get(f"/api/v1/chat/conversations/{chat.id}", headers=anya.headers)
    ).json()
    action_parts = [
        p for m in history["messages"] for p in m["parts"] if p["type"] == "data-action"
    ]
    assert action_parts[0]["data"]["status"] == "approved"
    requests = (await client.get("/api/v1/requests", headers=anya.headers)).json()
    assert requests[0]["payload"]["justification"] == "Задача LST-1432 про цены"


async def test_rejected_card_sends_nothing(
    client: AsyncClient, anya: Account, corp: FakeCorpServices
) -> None:
    chat = await Chat(client, anya).start()
    [card] = parts(await chat.say("Нужен доступ к дашбордам графана"), "action")

    rejected = parse((await chat.decide(card["id"], "reject")).text)

    assert "ничего не отправляю" in text_of(rejected)
    assert (await client.get("/api/v1/requests", headers=anya.headers)).json() == []
    assert "access_create" not in corp.calls


async def test_edits_are_limited_to_editable_fields(client: AsyncClient, anya: Account) -> None:
    chat = await Chat(client, anya).start()
    [card] = parts(await chat.say("Нужен доступ к дашбордам графана"), "action")

    response = await chat.decide(card["id"], resource="prod-db-listings")

    assert response.status_code == 409


async def test_expired_and_superseded_cards(
    client: AsyncClient, anya: Account, db: Database
) -> None:
    chat = await Chat(client, anya).start()
    [first] = parts(await chat.say("Нужен доступ к дашбордам графана"), "action")
    async with db.unit_of_work() as uow:
        await uow.session.execute(
            update(PendingAction).values(expires_at=PendingAction.created_at - timedelta(minutes=1))
        )
    expired = await chat.decide(first["id"])
    assert expired.json()["error_code"] == "ACTION_EXPIRED"

    [second] = parts(await chat.say("Нужен доступ к sentry"), "action")
    follow_up = await chat.say("Кто мой наставник?")
    assert "Иван Петров" in text_of(follow_up)
    stale = await chat.decide(second["id"])
    assert stale.json()["error_code"] == "ACTION_ALREADY_DECIDED"


async def test_already_granted_access_closes_the_step(client: AsyncClient, anya: Account) -> None:
    chunks = await (await Chat(client, anya).start()).say("Нужен доступ к jira")

    assert "уже есть доступ" in text_of(chunks)
    plan = (await client.get("/api/v1/plan", headers=anya.headers)).json()
    jira = next(i for s in plan["stages"] for i in s["items"] if i["slug"] == "access-jira")
    assert jira["status"] == "done"


async def test_knowledge_answer_with_sources_and_conflict(
    client: AsyncClient, anya: Account
) -> None:
    chunks = await (await Chat(client, anya).start()).say(
        "Куда отправить PR и кого позвать на ревью?"
    )

    [sources] = parts(chunks, "sources")
    assert sources["sources"][0]["synthetic"] is True
    assert sources["conflicts"][0]["topic"] == "code_review.rules"
    assert "расходятся" in text_of(chunks)


async def test_unknown_question_offers_the_mentor(
    client: AsyncClient, anya: Account, ivan: Account
) -> None:
    chat = await Chat(client, anya).start()
    chunks = await chat.say("Как оформить командировку в Казань?")
    [card] = parts(chunks, "action")
    assert card["tool"] == "ask_mentor"
    assert "Иван Петров" in card["card"]["fields"][0]["value"]

    approved = parse((await chat.decide(card["id"])).text)

    [escalation] = parts(approved, "escalation")
    assert escalation["assignee"] == "Иван Петров"
    assigned = (await client.get("/api/v1/escalations?scope=assigned", headers=ivan.headers)).json()
    assert "Как оформить командировку в Казань?" in {q["question"] for q in assigned}


async def test_sensitive_topic_goes_to_hrbp(client: AsyncClient, anya: Account) -> None:
    chunks = await (await Chat(client, anya).start()).say("Сколько зарплата у Ивана?")

    [card] = parts(chunks, "action")
    assert card["tool"] == "ask_mentor"
    assert "HRBP" in card["card"]["fields"][0]["value"]


async def test_plan_equipment_and_requests_tools(
    client: AsyncClient, anya: Account, corp: FakeCorpServices
) -> None:
    chat = await Chat(client, anya).start()

    plan = await chat.say("Что мне делать дальше?")
    laptop = await chat.say("Когда выдадут ноутбук?")
    requests = await chat.say("Какие у меня заявки?")
    who = await chat.say("Кто мой руководитель?")
    done = await chat.say("Отметь выполненным проверь каналы и заведи конспект")
    missing = await chat.say("Отметь выполненным полёт на Марс")

    assert parts(plan, "plan")[0]["next_steps"]
    assert parts(laptop, "equipment")[0]["items"][0]["status"] == "in_transit"
    assert "Пока ждёшь" in text_of(laptop)
    assert "Заявок пока нет" in text_of(requests)
    assert "Мария Ким" in text_of(who)
    assert "выполнен" in text_of(done)
    assert "Не нашёл" in text_of(missing)


async def test_absence_request_with_warnings(client: AsyncClient, anya: Account) -> None:
    day = today() + timedelta(days=1)
    chat = await Chat(client, anya).start()
    chunks = await chat.say(f"Хочу взять отгул {day:%d.%m}")
    cards = parts(chunks, "action")
    if day.weekday() >= 5:
        assert "выходной" in text_of(chunks) or "weekend" in text_of(chunks)
        return

    [card] = cards
    assert card["card"]["warnings"]  # one day's notice is below the test instruction's two
    approved = parse((await chat.decide(card["id"])).text)
    assert parts(approved, "request")[0]["kind"] == "absence"


async def test_team_message_and_it_ticket(
    client: AsyncClient, anya: Account, corp: FakeCorpServices, run_outbox: Any
) -> None:
    chat = await Chat(client, anya).start()
    [message_card] = parts(await chat.say("Напиши команде: завтра работаю из офиса"), "action")
    sent = parse((await chat.decide(message_card["id"])).text)
    await run_outbox()
    [ticket_card] = parts(await chat.say("У меня сломался ноутбук, создай тикет"), "action")
    await chat.decide(ticket_card["id"])

    assert message_card["card"]["fields"][0]["value"] == "#listings-backend"
    assert "Отправил сообщение" in text_of(sent)
    assert corp.messages == [
        {"channel": "#listings-backend", "text": "завтра работаю из офиса", "author": ANYA}
    ]
    requests = (await client.get("/api/v1/requests", headers=anya.headers)).json()
    assert requests[0]["kind"] == "equipment"


async def test_mentor_tools(client: AsyncClient, ivan: Account, kirill: Account) -> None:
    chat = await Chat(client, ivan).start()

    mentees = await chat.say("Как дела у моих подопечных?")
    questions = await chat.say("Покажи открытые вопросы от стажёров")

    assert "Кирилл Орлов" in text_of(mentees)
    assert "ветки" in text_of(questions)


async def test_conversations_feedback_and_privacy(
    client: AsyncClient, anya: Account, kirill: Account
) -> None:
    chat = await Chat(client, anya).start()
    await chat.say("Привет")
    history = (
        await client.get(f"/api/v1/chat/conversations/{chat.id}", headers=anya.headers)
    ).json()
    answer = next(m for m in history["messages"] if m["role"] == "assistant")

    rated = await client.post(
        f"/api/v1/chat/messages/{answer['id']}/feedback",
        json={"rating": "up"},
        headers=anya.headers,
    )
    others = await client.get(f"/api/v1/chat/conversations/{chat.id}", headers=kirill.headers)
    listed = (await client.get("/api/v1/chat/conversations", headers=anya.headers)).json()
    status = (await client.get("/api/v1/assistant/status", headers=anya.headers)).json()
    foreign_message = await client.post(
        f"/api/v1/chat/messages/{answer['id']}/feedback",
        json={"rating": "down"},
        headers=kirill.headers,
    )

    assert rated.status_code == 204
    assert others.status_code == 404
    assert listed[0]["title"] == "Привет"
    assert status == {"mode": "offline", "model": None, "embeddings": False}
    assert foreign_message.status_code == 404


async def test_chat_rate_limit(app_factory: AppFactory) -> None:
    async with app_factory(rate_limit_enabled=True, chat_rate_limit_per_minute=1) as (_, client):
        anya = await login(client, ANYA)
        chat = await Chat(client, anya).start()
        await chat.say("Привет")
        limited = await client.post(
            f"/api/v1/chat/conversations/{chat.id}/messages",
            json={"text": "Ещё"},
            headers=anya.headers,
        )

    assert limited.status_code == 429


def _failing(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
    raise ModelHTTPError(status_code=503, model_name="gpt-test", body="overloaded")


async def _failing_stream(messages: list[ModelMessage], info: AgentInfo) -> AsyncIterator[str]:
    raise ModelHTTPError(status_code=503, model_name="gpt-test", body="overloaded")
    yield ""  # pragma: no cover - makes this an async generator


def _broken() -> FunctionModel:
    return FunctionModel(_failing, stream_function=_failing_stream, model_name="gpt-test")


async def test_online_failure_falls_back_to_offline(
    app: FastAPI, client: AsyncClient, anya: Account
) -> None:
    runtime = app.state.chat
    app.state.chat = replace(
        runtime,
        online=True,
        model=FallbackModel(_broken(), build_offline_model(today)),
    )

    chunks = await (await Chat(client, anya).start()).say("Привет!")

    statuses = [c["data"].get("mode") for c in chunks if c["type"] == "data-status"]
    assert "offline" in statuses
    assert chunks[-1]["messageMetadata"]["mode"] == "offline"
    assert text_of(chunks).startswith("Привет! Я Орби")


async def test_broken_model_reports_an_error(
    app: FastAPI, client: AsyncClient, anya: Account
) -> None:
    app.state.chat = replace(app.state.chat, model=FunctionModel(_failing, model_name="gpt-test"))

    chunks = await (await Chat(client, anya).start()).say("Привет!")

    assert any(c["type"] == "error" for c in chunks)
    history = (await client.get("/api/v1/chat/conversations", headers=anya.headers)).json()
    assert history


async def test_mentor_answers_through_the_chat(
    client: AsyncClient, ivan: Account, kirill: Account
) -> None:
    question = (
        await client.get("/api/v1/escalations?scope=assigned", headers=ivan.headers)
    ).json()[0]
    chat = await Chat(client, ivan).start()
    runtime_tools = await chat.say("Покажи открытые вопросы от стажёров")
    assert question["question"] in text_of(runtime_tools)

    answer = "Ветки называем по ключу задачи: LST-123-описание. Это командное правило."
    response = await client.post(
        f"/api/v1/chat/conversations/{chat.id}/messages",
        json={"text": f"Ответь на вопрос {question['id']}: {answer}"},
        headers=ivan.headers,
    )
    assert response.status_code == 200
    answered = await client.post(
        f"/api/v1/escalations/{question['id']}/answer",
        json={"answer": answer, "publish_to_faq": True},
        headers=ivan.headers,
    )
    assert answered.json()["faq_document_slug"]
    mine = (await client.get("/api/v1/escalations", headers=kirill.headers)).json()
    assert mine[0]["status"] == "answered"


async def test_requests_tool_lists_existing_requests(
    client: AsyncClient, anya: Account, run_outbox: Any
) -> None:
    chat = await Chat(client, anya).start()
    [card] = parts(await chat.say("Нужен доступ к дашбордам графана"), "action")
    await chat.decide(card["id"])

    listed = await chat.say("Какие у меня заявки?")

    assert "Дашборды Grafana" in text_of(listed)
    assert parts(listed, "request")
