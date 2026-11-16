"""Specs 009, 010, 011: the work loop (Jira, Stash), office booking and learning in the chat.

The offline model drives the same tools as the LLM, so these tests walk the user path:
question → tool → card → confirmation → saved request → decision.
"""

import json
import time
from datetime import date, datetime, timedelta
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.clock import LOCAL_TZ
from app.core.config import Settings
from app.core.security import webhooks
from app.db.database import Database
from app.db.models import Notification, ServiceRequest
from app.domain.corp import CorpEvent, CorpTicketStatus, CorpUnavailableError
from app.domain.devflow import IssueStatus, PullStatus
from app.domain.learning import CourseStatus
from app.domain.requests import RequestKind, RequestStatus
from app.service.nudges import Nudges
from app.service.requests import reconcile_ticket
from tests.fakes import FakeCorpServices, course, pull
from tests.integration.conftest import ANYA, IVAN, KIRILL, Account
from tests.integration.test_chat_api import Chat, parse, parts, text_of


def _weekday(days_ahead: int = 2) -> date:
    day = date.today() + timedelta(days=days_ahead)
    while day.weekday() >= 5:
        day += timedelta(days=1)
    return day


def _saturday() -> date:
    day = date.today() + timedelta(days=1)
    while day.weekday() != 5:
        day += timedelta(days=1)
    return day


async def _webhook(client: AsyncClient, settings: Settings, **body: Any) -> int:
    raw = json.dumps({"event": "request.status_changed", **body}).encode()
    timestamp = str(int(time.time()))
    signature = webhooks.sign(settings.corp_webhook_secret.get_secret_value(), timestamp, raw)
    response = await client.post(
        "/api/v1/integrations/corp/webhook",
        content=raw,
        headers={
            "X-Corp-Timestamp": timestamp,
            "X-Corp-Signature": signature,
            "Content-Type": "application/json",
        },
    )
    return response.status_code


async def _plan_status(client: AsyncClient, account: Account, slug: str) -> str:
    plan = (await client.get("/api/v1/plan", headers=account.headers)).json()
    return str(next(i for s in plan["stages"] for i in s["items"] if i["slug"] == slug)["status"])


# ---- work loop -----------------------------------------------------------------------------------


async def test_tasks_and_repository_guide(client: AsyncClient, anya: Account) -> None:
    chat = await Chat(client, anya).start()

    tasks = await chat.say("Какие у меня задачи?")
    [part] = parts(tasks, "tasks")
    assert [i["key"] for i in part["issues"]] == ["LST-1432", "LST-1440"]
    assert "Начни с LST-1432" in text_of(tasks)

    guide = text_of(await chat.say("Как склонировать репозиторий listings-api?"))
    assert "git clone ssh://git@stash.buddy.test:7999/lst/listings-api.git" in guide
    assert "git checkout -b LST-1432-demo" in guide
    assert "listings.dev.buddy.test" in guide


async def test_start_task_moves_the_issue_and_the_plan_step(
    client: AsyncClient, anya: Account, corp: FakeCorpServices
) -> None:
    chat = await Chat(client, anya).start()
    [card] = parts(await chat.say("Возьми в работу LST-1432"), "action")
    assert card["card"]["kind"] == "start_task"
    assert "transition_issue" not in corp.calls

    done = parse((await chat.decide(card["id"])).text)

    assert "git checkout -b LST-1432-demo" in text_of(done)
    assert corp.issues_by[ANYA][0].status is IssueStatus.IN_PROGRESS
    assert await _plan_status(client, anya, "first-pr") == "in_progress"
    again = text_of(await chat.say("Возьми в работу LST-1432"))
    assert "уже в работе" in again
    assert "нет" in text_of(await chat.say("Возьми в работу LST-9999"))


async def test_review_request_end_to_end(
    client: AsyncClient,
    kirill: Account,
    ivan: Account,
    corp: FakeCorpServices,
    settings: Settings,
    run_outbox: Any,
) -> None:
    chat = await Chat(client, kirill).start()
    [card] = parts(await chat.say("Отправь мой PR на ревью"), "action")
    fields = {f["key"]: f for f in card["card"]["fields"]}
    assert "Иван Петров — обязательный аппрув" in fields["reviewers"]["value"]
    assert "Дмитрий Лебедев — владелец internal/moderation/" in fields["reviewers"]["value"]
    assert fields["message"]["editable"] is True
    assert card["card"]["warnings"] == []

    approved = parse((await chat.decide(card["id"], message="Глянете сегодня?")).text)

    [request] = parts(approved, "request")
    assert request["kind"] == "review"
    assert request["status"] == "submitted"
    assert corp.sent[-1] == {
        "review": "PR-87",
        "reviewers": [IVAN, "dmitry.backend@buddy.test"],
        "message": "Глянете сегодня?",
    }
    notes = (await client.get("/api/v1/notifications", headers=ivan.headers)).json()
    assert any("просит ревью PR-87" in n["title"] for n in notes["items"])

    duplicate = text_of(await chat.say("Отправь мой PR на ревью"))
    assert "уже запрошено" in duplicate

    status = await _webhook(
        client,
        settings,
        service="review",
        request_id=request["external_id"],
        status="approved",
        comment="Аппрув получен",
    )
    assert status == 200
    mine = (await client.get("/api/v1/requests", headers=kirill.headers)).json()
    assert mine[0]["status"] == "approved"


async def test_review_warnings_and_refusals(
    client: AsyncClient, kirill: Account, dana: Account, corp: FakeCorpServices
) -> None:
    corp.pulls_by[KIRILL] = [pull(checks="failed", changed=("internal/publish/x.go",))]
    chat = await Chat(client, kirill).start()
    [card] = parts(await chat.say("Подбери ревьюеров на ревью моего PR"), "action")
    assert "make lint test" in card["card"]["warnings"][0]
    assert "Елена Захарова" in card["card"]["fields"][2]["value"]

    corp.pulls_by[KIRILL] = [pull(status=PullStatus.APPROVED)]
    assert "уже одобрен" in text_of(await chat.say("Отправь мой PR на ревью"))

    nothing = await Chat(client, dana).start()
    assert "Не нашёл у тебя открытый pull request" in text_of(
        await nothing.say("Отправь мой PR на ревью")
    )


async def test_work_tools_survive_an_outage(
    client: AsyncClient, anya: Account, corp: FakeCorpServices
) -> None:
    chat = await Chat(client, anya).start()
    corp.unavailable = True
    for prompt in (
        "Какие у меня задачи?",
        "Как склонировать репозиторий?",
        "Возьми в работу LST-1432",
        "Отправь мой PR на ревью",
        "Какие у меня курсы?",
        "Покажи мой ИПР",
        "Найди курс по Go",
        "Запиши меня на курс по Go",
        f"Забронируй переговорку на {_weekday():%d.%m.%Y}",
        f"Какие свободные переговорки на {_weekday():%d.%m.%Y}?",
    ):
        assert "не отвечает" in text_of(await chat.say(prompt)), prompt


# ---- office --------------------------------------------------------------------------------------


async def test_mentor_meeting_finds_a_common_slot_and_invites_the_mentor(
    client: AsyncClient, anya: Account, corp: FakeCorpServices
) -> None:
    day = _weekday()
    chat = await Chat(client, anya).start()
    [card] = parts(
        await chat.say(f"Забронируй переговорку для 1:1 с наставником на {day:%d.%m.%Y}"),
        "action",
    )
    fields = {f["key"]: f["value"] for f in card["card"]["fields"]}
    assert fields["place"].startswith("Переговорка «Онега»")  # the smallest room that fits
    assert fields["when"] == f"{day:%d.%m} 10:00–10:30"
    assert fields["attendees"] == "Иван Петров"

    done = parse((await chat.decide(card["id"], title="Обсудить первую задачу")).text)

    [request] = parts(done, "request")
    assert request["kind"] == "booking"
    assert request["status"] == "submitted"
    assert corp.sent[-1]["attendees"] == [IVAN]


async def test_booking_desk_room_at_a_time_and_refusals(
    client: AsyncClient, anya: Account, corp: FakeCorpServices
) -> None:
    day = _weekday()
    chat = await Chat(client, anya).start()

    found = text_of(await chat.say(f"Какие свободные рабочие места на {day:%d.%m.%Y}?"))
    assert "Место 5.14" in found
    rooms = text_of(await chat.say(f"Найди свободную переговорку на {day:%d.%m.%Y} в 15:30"))
    assert "15:30–16:00" in rooms

    [card] = parts(await chat.say(f"Забронируй рабочее место на {day:%d.%m.%Y}"), "action")
    assert card["card"]["fields"][1]["value"] == f"{day:%d.%m}, весь день"
    [request] = parts(parse((await chat.decide(card["id"])).text), "request")
    assert request["status"] == "approved"

    [timed] = parts(await chat.say(f"Забронируй переговорку на {day:%d.%m.%Y} в 16:00"), "action")
    assert timed["card"]["fields"][1]["value"] == f"{day:%d.%m} 16:00–16:30"
    corp.taken = {"room-onega"}
    assert "уже заняли" in text_of(parse((await chat.decide(timed["id"])).text))
    [again] = parts(await chat.say(f"Забронируй переговорку на {day:%d.%m.%Y} в 16:00"), "action")
    corp.taken = {"room-onega", "room-baikal"}
    assert "уже заняли" in text_of(parse((await chat.decide(again["id"])).text))
    assert "другой день" in text_of(await chat.say(f"Забронируй переговорку на {day:%d.%m.%Y}"))
    corp.taken.add("desk-5-14")
    no_desks = text_of(await chat.say(f"Какие свободные рабочие места на {day:%d.%m.%Y}?"))
    assert "свободных мест нет" in no_desks
    weekend = text_of(await chat.say(f"Забронируй переговорку на {_saturday():%d.%m.%Y}"))
    assert "рабочие дни" in weekend


async def test_free_slot_skips_both_calendars(
    client: AsyncClient, anya: Account, corp: FakeCorpServices
) -> None:
    day = _weekday()
    standup = datetime(day.year, day.month, day.day, 10, tzinfo=LOCAL_TZ)
    corp.events = [CorpEvent("Стендап", standup, important=False, minutes=30)]
    chat = await Chat(client, anya).start()
    text = text_of(
        await chat.say(f"Найди свободную переговорку для встречи с наставником {day:%d.%m.%Y}")
    )
    assert "10:30–11:00" in text
    assert "оба свободны" in text


# ---- learning ------------------------------------------------------------------------------------


async def test_courses_idp_and_catalog(client: AsyncClient, anya: Account) -> None:
    chat = await Chat(client, anya).start()

    courses = await chat.say("Какие у меня курсы?")
    [part] = parts(courses, "learning")
    assert part["courses"][0]["id"] == "data-protection"
    assert "⚠ скоро" in text_of(courses)

    idp = await chat.say("Покажи мой ИПР")
    assert parts(idp, "learning")[0]["goals"][0]["competency"] == "Инженерные практики"

    catalog = text_of(await chat.say("Найди курс по Kubernetes"))
    assert "Kubernetes на практике" in catalog
    assert "согласование руководителя" in catalog


async def test_enrollment_moves_the_plan_step_and_external_goes_to_the_lead(
    client: AsyncClient, anya: Account, corp: FakeCorpServices
) -> None:
    chat = await Chat(client, anya).start()
    [card] = parts(await chat.say("Запиши меня на курс по микросервисам"), "action")
    assert card["card"]["kind"] == "enroll_course"
    [request] = parts(parse((await chat.decide(card["id"])).text), "request")
    assert request["status"] == "approved"
    assert await _plan_status(client, anya, "microservices-course") == "in_progress"

    [external] = parts(await chat.say("Запиши меня на курс Kubernetes"), "action")
    assert external["card"]["fields"][2]["value"] == "Руководитель (бюджет обучения)"
    [pending] = parts(parse((await chat.decide(external["id"])).text), "request")
    assert pending["status"] == "submitted"
    assert "уже на согласовании" in text_of(await chat.say("Запиши меня на курс Kubernetes"))

    corp.courses_by[ANYA].append(course("go-basics"))
    assert "уже записан" in text_of(await chat.say("Запиши меня на курс по Go"))
    assert "Уточни" in text_of(await chat.say("Запиши меня на курс для бэкендеров и микросервисы"))
    assert "не нашёл" in text_of(await chat.say("Запиши меня на курс по вязанию"))


async def test_learning_cron_reminds_and_closes_finished_courses(
    client: AsyncClient,
    kirill: Account,
    db: Database,
    corp: FakeCorpServices,
    settings: Settings,
) -> None:
    nudges = Nudges(db, corp, settings)
    assert await nudges.learning_follow_up() == 2  # Anya's and Kirill's deadlines in 2 days
    assert await nudges.learning_follow_up() == 0  # once a day per course

    corp.courses_by[KIRILL] = [course("microservices", status=CourseStatus.COMPLETED, progress=100)]
    assert await nudges.learning_follow_up() == 1
    assert await _plan_status(client, kirill, "microservices-course") == "done"

    corp.unavailable = True
    assert await nudges.learning_follow_up() == 0
    async with db.unit_of_work() as uow:
        titles = (await uow.session.scalars(select(Notification.title))).all()
    assert any("дедлайн через 2 дн." in t for t in titles)


async def test_new_kinds_reconcile_through_the_generic_status(
    client: AsyncClient, kirill: Account, db: Database, corp: FakeCorpServices
) -> None:
    chat = await Chat(client, kirill).start()
    [card] = parts(await chat.say("Отправь мой PR на ревью"), "action")
    [request] = parts(parse((await chat.decide(card["id"])).text), "request")
    corp.decide(request["external_id"], CorpTicketStatus.APPROVED, "Аппрув")
    async with db.unit_of_work() as uow:
        row = await uow.session.scalar(
            select(ServiceRequest).where(ServiceRequest.kind == RequestKind.REVIEW)
        )
        assert row is not None
        ticket = await reconcile_ticket(corp, row)
    assert ticket is not None
    assert ticket.status is CorpTicketStatus.APPROVED
    assert row.status is RequestStatus.SUBMITTED
    corp.unavailable = True
    async with db.unit_of_work() as uow:
        row = await uow.session.scalar(
            select(ServiceRequest).where(ServiceRequest.kind == RequestKind.REVIEW)
        )
        assert row is not None
        with pytest.raises(CorpUnavailableError):
            await reconcile_ticket(corp, row)
