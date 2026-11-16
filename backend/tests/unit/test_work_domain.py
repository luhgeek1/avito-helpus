from datetime import date, datetime, timedelta

import pytest

from app.core.clock import LOCAL_TZ
from app.domain.devflow import IssueStatus, PullStatus, review_warnings, suggest_reviewers
from app.domain.learning import CourseStatus
from app.domain.office import (
    BookingDateError,
    Interval,
    end_time,
    ensure_bookable_day,
    free_slots,
)
from app.service.assistant.deps import TOOL_PERMISSIONS
from app.service.assistant.offline import route
from app.service.devflow import DevOverview
from tests.fakes import DMITRY, ELENA, IVAN, course, issue, listings_repository, pull

TODAY = date(2026, 11, 16)  # Monday
TOOLS = {
    name
    for name in TOOL_PERMISSIONS
    if name not in {"list_mentees", "open_questions", "answer_question"}
}


def test_reviewers_required_approver_then_most_specific_owner() -> None:
    repo = listings_repository()
    changed = ("internal/moderation/rules.go", "internal/publish/draft.go", "README.md")

    chosen = suggest_reviewers(pull(changed=changed), repo, author="kirill.intern@buddy.test")

    assert [s.member for s in chosen] == [IVAN, DMITRY, ELENA]
    assert chosen[0].reason == "обязательный аппрув"
    assert chosen[1].reason == "владелец internal/moderation/"


def test_author_never_reviews_and_catch_all_owner_is_used() -> None:
    chosen = suggest_reviewers(
        pull(changed=("cmd/main.go",)), listings_repository(), author=IVAN.email
    )
    assert chosen == []
    other = suggest_reviewers(pull(changed=("cmd/main.go",)), listings_repository(), author="x")
    assert [s.reason for s in other] == ["обязательный аппрув"]


def test_review_warnings() -> None:
    repo = listings_repository()
    assert review_warnings(pull(), repo) == []
    failed = review_warnings(pull(checks="failed"), repo)
    assert "make lint test" in failed[0]
    wrong_target = pull()
    object.__setattr__(wrong_target, "target", "main")
    assert "принято открывать в develop" in review_warnings(wrong_target, repo)[0]
    assert pull(status=PullStatus.CHANGES_REQUESTED).status_title == "нужны правки"


def test_current_issue_prefers_work_in_progress_then_the_first_task() -> None:
    first = issue("LST-1", first=True)
    later = issue("LST-2")
    busy = issue("LST-3", status=IssueStatus.IN_PROGRESS)
    done = issue("LST-4", status=IssueStatus.DONE)
    assert DevOverview([later, first], []).current == first
    assert DevOverview([later, first, busy, done], []).current == busy
    assert DevOverview([done], []).current is None
    assert busy.status_title == "в работе"


def test_free_slots_skip_lunch_busy_time_and_the_past() -> None:
    day = TODAY
    at = lambda h, m=0: datetime(day.year, day.month, day.day, h, m, tzinfo=LOCAL_TZ)  # noqa: E731
    busy = [Interval(at(10), at(11)), Interval(at(11, 30), at(12))]

    slots = free_slots(busy, day, timedelta(minutes=30), tz=LOCAL_TZ)
    assert [f"{s.start:%H:%M}" for s in slots[:3]] == ["11:00", "12:00", "12:30"]
    assert all(s.start.hour != 13 for s in slots)
    later = free_slots([], day, timedelta(minutes=60), tz=LOCAL_TZ, not_before=at(17, 10))
    assert [f"{s.start:%H:%M}" for s in later] == ["17:30", "18:00"]


def test_bookable_days_and_end_time() -> None:
    ensure_bookable_day(TODAY, TODAY)
    for day in (TODAY - timedelta(days=1), date(2026, 11, 21), TODAY + timedelta(days=31)):
        with pytest.raises(BookingDateError):
            ensure_bookable_day(day, TODAY)
    assert end_time("15:30", 30) == "16:00"
    assert end_time("09:00", 90) == "10:30"


def test_course_deadline_soon() -> None:
    today = date.today()
    assert course("a", due_days=2).deadline_soon(today)
    assert not course("a", due_days=5).deadline_soon(today)
    assert not course("a", status=CourseStatus.COMPLETED).deadline_soon(today)
    assert not course("a", due_days=-1).deadline_soon(today)
    assert course("a").status_title == "в процессе"


@pytest.mark.parametrize(
    ("prompt", "tool", "args"),
    [
        ("Какие у меня задачи?", "my_tasks", {}),
        ("Какая моя первая задача?", "my_tasks", {}),
        ("Какой статус моего PR?", "my_tasks", {}),
        ("Возьми в работу LST-1432", "start_task", {"issue_key": "LST-1432"}),
        ("Отправь мой PR на ревью", "request_review", {}),
        ("Подбери ревьюеров на ревью PR-87", "request_review", {}),
        ("Как склонировать listings-api?", "repository_guide", {"repository": "listings-api"}),
        ("Дай ссылку на репозиторий", "repository_guide", {}),
        (
            "Забронируй переговорку для 1:1 с наставником на 18.11",
            "book_workspace",
            {"kind": "room", "with_mentor": True, "day": "2026-11-18"},
        ),
        (
            "Забронируй переговорку на 18.11 в 15:30",
            "book_workspace",
            {"kind": "room", "with_mentor": False, "day": "2026-11-18", "start_time": "15:30"},
        ),
        (
            "Забронируй рабочее место на завтра",
            "book_workspace",
            {"kind": "desk", "with_mentor": False, "day": "2026-11-17"},
        ),
        (
            "Какие свободные переговорки завтра?",
            "find_workspace",
            {"kind": "room", "with_mentor": False, "day": "2026-11-17"},
        ),
        (
            "Запланируй встречу с наставником",
            "book_workspace",
            {"kind": "room", "with_mentor": True},
        ),
        ("Какие у меня курсы?", "my_learning", {}),
        ("Покажи мой ИПР", "my_development_plan", {}),
        ("Найди курс по Kubernetes", "find_courses", {"query": "Kubernetes"}),
        ("Запиши меня на курс по Go", "enroll_course", {"course": "Go"}),
        (
            "Отмени заявку BKG-5201",
            "control_request",
            {"reference": "BKG-5201", "action": "cancel"},
        ),
    ],
)
def test_offline_routes_work_intents(prompt: str, tool: str, args: dict[str, object]) -> None:
    intent = route(prompt, TOOLS, TODAY)
    assert intent.tool == tool
    assert intent.args == args


@pytest.mark.parametrize(
    "prompt",
    [
        "Кого позвать на ревью?",
        "Куда отправить PR и кого позвать на ревью?",
        "Как скачать репозиторий?",
        "Где лежат цели и ИПР?",
        "Как проверить фичу на dev?",
    ],
)
def test_rule_questions_still_go_to_the_knowledge_base(prompt: str) -> None:
    assert route(prompt, TOOLS, TODAY).tool == "search_knowledge"


def test_greeting_mentions_new_abilities() -> None:
    greeting = route("Привет", TOOLS, TODAY).text or ""
    assert "позвать на ревью" in greeting
    assert "забронировать переговорку" in greeting
    assert "записать на курс" in greeting
