from collections.abc import Sequence
from dataclasses import dataclass, field, replace
from datetime import date, datetime, timedelta
from itertools import count
from typing import Any

from app.domain.corp import (
    AccessGrant,
    CorpEvent,
    CorpRequestError,
    CorpTicket,
    CorpTicketStatus,
    CorpUnavailableError,
    EquipmentItem,
    EquipmentStatus,
)
from app.domain.devflow import (
    CodeOwnerRule,
    Issue,
    IssueStatus,
    PullRequest,
    PullStatus,
    Repository,
    TeamMember,
)
from app.domain.learning import (
    CatalogCourse,
    Course,
    CourseStatus,
    DevelopmentGoal,
    GoalStatus,
)
from app.domain.office import Desk, Room


@dataclass
class FakeCorpServices:
    """In-process stand-in for the corporate services port, with knobs for failure paths."""

    grants: dict[tuple[str, str], AccessGrant] = field(default_factory=dict)
    balances: dict[str, int] = field(default_factory=dict)
    events: list[CorpEvent] = field(default_factory=list)
    equipment_items: dict[str, list[EquipmentItem]] = field(default_factory=dict)
    tickets: dict[str, CorpTicket] = field(default_factory=dict)
    by_key: dict[str, str] = field(default_factory=dict)
    messages: list[dict[str, str]] = field(default_factory=list)
    reminders: list[str] = field(default_factory=list)
    calls: list[str] = field(default_factory=list)
    unavailable: bool = False
    refuse_with: str | None = None
    auto_decision: CorpTicketStatus | None = None
    issues_by: dict[str, list[Issue]] = field(default_factory=dict)
    repositories: dict[str, Repository] = field(default_factory=dict)
    pulls_by: dict[str, list[PullRequest]] = field(default_factory=dict)
    rooms: list[Room] = field(default_factory=list)
    desks: list[Desk] = field(default_factory=list)
    taken: set[str] = field(default_factory=set)
    courses_by: dict[str, list[Course]] = field(default_factory=dict)
    catalog: list[CatalogCourse] = field(default_factory=list)
    goals_by: dict[str, list[DevelopmentGoal]] = field(default_factory=dict)
    sent: list[dict[str, Any]] = field(default_factory=list)
    _ids: Any = field(default_factory=lambda: count(1042))

    def _guard(self, name: str) -> None:
        self.calls.append(name)
        if self.unavailable:
            raise CorpUnavailableError(f"{name}: service unavailable")
        if self.refuse_with and name.endswith("_create"):
            raise CorpRequestError(self.refuse_with)

    def _ticket(self, prefix: str, key: str, approver: str | None) -> CorpTicket:
        if key in self.by_key:
            return self.tickets[self.by_key[key]]
        status = self.auto_decision or CorpTicketStatus.PENDING_APPROVAL
        ticket = CorpTicket(
            external_id=f"{prefix}-{next(self._ids)}",
            status=status,
            sla_hours=24,
            approver=approver,
            comment="Сразу одобрено" if status is CorpTicketStatus.APPROVED else None,
        )
        self.tickets[ticket.external_id] = ticket
        self.by_key[key] = ticket.external_id
        return ticket

    def decide(
        self, external_id: str, status: CorpTicketStatus, comment: str | None = None
    ) -> None:
        ticket = self.tickets[external_id]
        self.tickets[external_id] = CorpTicket(
            external_id=ticket.external_id, status=status, comment=comment, sla_hours=24
        )

    async def access_check(self, *, employee: str, resource: str) -> AccessGrant:
        self._guard("access_check")
        return self.grants.get((employee, resource), AccessGrant(has_access=False))

    async def access_create(
        self,
        *,
        employee: str,
        resource: str,
        level: str,
        justification: str,
        approver: str,
        idempotency_key: str,
    ) -> CorpTicket:
        self._guard("access_create")
        return self._ticket("ACC", idempotency_key, approver)

    async def access_get(self, external_id: str) -> CorpTicket:
        self._guard("access_get")
        if external_id not in self.tickets:
            raise CorpRequestError("unknown request")
        return self.tickets[external_id]

    async def access_remind(self, external_id: str, *, idempotency_key: str | None = None) -> None:
        self._guard("access_remind")
        self.reminders.append(external_id)

    async def cancel_request(self, external_id: str) -> CorpTicket:
        self._guard("cancel_request")
        if self.tickets[external_id].status is CorpTicketStatus.PENDING_APPROVAL:
            self.decide(external_id, CorpTicketStatus.CANCELLED, "Отменено сотрудником")
        return self.tickets[external_id]

    async def absence_balance(self, *, employee: str) -> int:
        self._guard("absence_balance")
        return self.balances.get(employee, 5)

    async def absence_create(
        self,
        *,
        employee: str,
        type_: str,
        start: date,
        end: date,
        comment: str,
        idempotency_key: str,
    ) -> CorpTicket:
        self._guard("absence_create")
        return self._ticket("ABS", idempotency_key, "Руководитель")

    async def absence_get(self, external_id: str) -> CorpTicket:
        self._guard("absence_get")
        return self.tickets[external_id]

    async def calendar_events(self, *, employee: str, start: date, end: date) -> list[CorpEvent]:
        self._guard("calendar_events")
        return [e for e in self.events if start <= e.starts_at.date() <= end]

    async def equipment(self, *, employee: str) -> list[EquipmentItem]:
        self._guard("equipment")
        return self.equipment_items.get(employee, [])

    async def it_ticket_create(
        self, *, employee: str, category: str, description: str, idempotency_key: str
    ) -> CorpTicket:
        self._guard("it_ticket_create")
        return self._ticket("IT", idempotency_key, "IT-поддержка")

    async def it_ticket_get(self, external_id: str) -> CorpTicket:
        self._guard("it_ticket_get")
        return self.tickets[external_id]

    async def post_message(
        self, *, channel: str, text: str, author: str, idempotency_key: str
    ) -> str:
        self._guard("post_message")
        self.messages.append({"channel": channel, "text": text, "author": author})
        return f"msg-{len(self.messages)}"

    async def request_get(self, external_id: str) -> CorpTicket:
        self._guard("request_get")
        if external_id not in self.tickets:
            raise CorpRequestError("unknown request")
        return self.tickets[external_id]

    async def issues(self, *, employee: str) -> list[Issue]:
        self._guard("issues")
        return list(self.issues_by.get(employee, []))

    async def transition_issue(
        self, *, employee: str, key: str, status: IssueStatus, idempotency_key: str
    ) -> Issue:
        self._guard("transition_issue")
        mine = self.issues_by.get(employee, [])
        index = next((i for i, issue in enumerate(mine) if issue.key == key), None)
        if index is None:
            raise CorpRequestError("issue is assigned to another employee")
        mine[index] = replace(mine[index], status=status)
        return mine[index]

    async def repository(self, slug: str) -> Repository:
        self._guard("repository")
        if slug not in self.repositories:
            raise CorpRequestError(f"unknown repository {slug}")
        return self.repositories[slug]

    async def pull_requests(self, *, employee: str) -> list[PullRequest]:
        self._guard("pull_requests")
        return list(self.pulls_by.get(employee, []))

    async def review_create(
        self,
        *,
        employee: str,
        pull_request: str,
        reviewers: Sequence[str],
        message: str,
        idempotency_key: str,
    ) -> CorpTicket:
        self._guard("review_create")
        self.sent.append({"review": pull_request, "reviewers": list(reviewers), "message": message})
        return self._ticket("REV", idempotency_key, ", ".join(reviewers))

    async def free_rooms(self, *, day: date, start: str, end: str, capacity: int) -> list[Room]:
        self._guard("free_rooms")
        return [r for r in self.rooms if r.capacity >= capacity and r.id not in self.taken]

    async def free_desks(self, *, day: date) -> list[Desk]:
        self._guard("free_desks")
        return [d for d in self.desks if d.id not in self.taken]

    async def booking_create(
        self,
        *,
        employee: str,
        resource: str,
        day: date,
        start: str,
        end: str,
        title: str,
        attendees: Sequence[str],
        idempotency_key: str,
    ) -> CorpTicket:
        self._guard("booking_create")
        self.sent.append(
            {"booking": resource, "day": day, "start": start, "end": end, "attendees": attendees}
        )
        if attendees:
            return self._ticket("BKG", idempotency_key, ", ".join(attendees))
        return self._instant("BKG", idempotency_key, f"Забронировано: {resource}")

    async def courses(self, *, employee: str) -> list[Course]:
        self._guard("courses")
        return list(self.courses_by.get(employee, []))

    async def course_catalog(self, *, employee: str, query: str) -> list[CatalogCourse]:
        self._guard("course_catalog")
        words = [w.lower()[:4] for w in query.split() if len(w) > 1 and not w.startswith("курс")]
        taken = {c.id for c in self.courses_by.get(employee, [])}
        return [
            replace(c, enrolled=c.id in taken)
            for c in self.catalog
            if not words or any(w in c.title.lower() or w in c.id for w in words)
        ]

    async def course_enroll(
        self, *, employee: str, course: str, idempotency_key: str
    ) -> CorpTicket:
        self._guard("course_enroll")
        self.sent.append({"course": course, "employee": employee})
        external = next((c.external for c in self.catalog if c.id == course), False)
        if external:
            return self._ticket("EDU", idempotency_key, "Руководитель")
        return self._instant("EDU", idempotency_key, "Доступ к курсу открыт")

    async def development_plan(self, *, employee: str) -> list[DevelopmentGoal]:
        self._guard("development_plan")
        return list(self.goals_by.get(employee, []))

    def _instant(self, prefix: str, key: str, comment: str) -> CorpTicket:
        """Services that confirm on the spot (a free desk, an internal course)."""
        if key in self.by_key:
            return self.tickets[self.by_key[key]]
        ticket = CorpTicket(
            external_id=f"{prefix}-{next(self._ids)}",
            status=CorpTicketStatus.APPROVED,
            comment=comment,
            sla_hours=4,
            idempotency_key=key,
        )
        self.tickets[ticket.external_id] = ticket
        self.by_key[key] = ticket.external_id
        return ticket

    async def reset_demo(self) -> None:
        self._guard("reset_demo")
        self.tickets.clear()
        self.by_key.clear()


def laptop(status: EquipmentStatus, *, eta_days: int = 1) -> EquipmentItem:
    return EquipmentItem(
        kind="laptop",
        model="MacBook Pro 14",
        status=status,
        eta=date.today() + timedelta(days=eta_days),
        pickup_location="IT-стойка, 5 этаж",
        pickup_hours="будни 10:00–18:00",
    )


def meeting(title: str, on: date, *, important: bool = True) -> CorpEvent:
    return CorpEvent(
        title=title, starts_at=datetime(on.year, on.month, on.day, 15), important=important
    )


class FakeEmbeddings:
    """Deterministic bag-of-letters vectors: similar texts get similar vectors, no network."""

    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.calls = 0

    def _vector(self, text: str) -> list[float]:
        vector = [0.0] * 1024
        for index, char in enumerate(text.lower()):
            vector[(ord(char) * 31 + index % 7) % 1024] += 1.0
        norm = sum(v * v for v in vector) ** 0.5 or 1.0
        return [v / norm for v in vector]

    async def embed_query(self, text: str) -> Sequence[float]:
        self.calls += 1
        if self.fail:
            raise RuntimeError("embeddings are down")
        return self._vector(text)

    async def embed_documents(self, texts: Sequence[str]) -> list[Sequence[float]]:
        self.calls += 1
        return [self._vector(text) for text in texts]


class RecordingPublisher:
    def __init__(self) -> None:
        self.events: list[tuple[str, str, dict[str, Any]]] = []

    async def publish(self, user_id: str, event: str, data: dict[str, Any]) -> None:
        self.events.append((user_id, event, data))


class FakeGenerator:
    def __init__(self, answer: str | None) -> None:
        self.answer = answer
        self.prompts: list[str] = []

    async def generate(self, instructions: str, prompt: str) -> str | None:
        self.prompts.append(prompt)
        return self.answer


IVAN = TeamMember("ivan.mentor@buddy.test", "Иван Петров")
DMITRY = TeamMember("dmitry.backend@buddy.test", "Дмитрий Лебедев")
ELENA = TeamMember("elena.backend@buddy.test", "Елена Захарова")


def listings_repository() -> Repository:
    return Repository(
        slug="listings-api",
        project="LST",
        clone_url="ssh://git@stash.buddy.test:7999/lst/listings-api.git",
        web_url="https://stash.buddy.test/projects/LST/repos/listings-api",
        default_branch="develop",
        dev_url="https://listings.dev.buddy.test",
        run="avito-cli service run listings-api",
        checks="make lint test",
        review_group="@listings-reviewers",
        team_channel="#listings-backend",
        required_approvers=(IVAN,),
        codeowners=(
            CodeOwnerRule("internal/moderation/", (DMITRY,)),
            CodeOwnerRule("internal/publish/", (ELENA,)),
            CodeOwnerRule("*", (IVAN,)),
        ),
    )


def issue(key: str, *, status: IssueStatus = IssueStatus.TODO, first: bool = False) -> Issue:
    return Issue(
        key=key,
        title=f"Задача {key}",
        type="task",
        status=status,
        points=2,
        due=date.today() + timedelta(days=5),
        repository="listings-api",
        branch=f"{key}-demo",
        description="",
        url=f"https://jira.buddy.test/browse/{key}",
        first_task=first,
    )


def pull(
    pr_id: str = "PR-87",
    *,
    checks: str = "passed",
    status: PullStatus = PullStatus.OPEN,
    changed: tuple[str, ...] = ("internal/moderation/rules.go",),
) -> PullRequest:
    return PullRequest(
        id=pr_id,
        repository="listings-api",
        title="LST-1405: ограничить длину заголовка",
        branch="LST-1405-title-length-limit",
        target="develop",
        issue="LST-1405",
        status=status,
        checks=checks,
        changed=changed,
        reviewers=(),
        url=f"https://stash.buddy.test/projects/listings-api/pull-requests/{pr_id}",
    )


def course(
    course_id: str,
    *,
    status: CourseStatus = CourseStatus.IN_PROGRESS,
    due_days: int = 2,
    progress: int = 40,
) -> Course:
    return Course(
        id=course_id,
        title=f"Курс {course_id}",
        provider="Учебная платформа",
        hours=4,
        mandatory=True,
        due=date.today() + timedelta(days=due_days),
        progress=progress,
        status=status,
        url=f"https://learn.buddy.test/courses/{course_id}",
    )


CATALOG = [
    CatalogCourse(
        "microservices", "Микросервисная архитектура", "Учебная платформа", 6, False, False
    ),
    CatalogCourse("go-basics", "Go для бэкендеров", "Учебная платформа", 12, False, False),
    CatalogCourse("k8s-practice", "Kubernetes на практике", "Внешний провайдер", 16, True, False),
]
ROOMS = [
    Room("room-onega", "Переговорка «Онега»", 5, 2, "тихая"),
    Room("room-baikal", "Переговорка «Байкал»", 5, 4, "экран"),
]
DESKS = [Desk("desk-5-14", "Место 5.14", 5, "зона команды")]
GOAL = DevelopmentGoal(
    "Сделать первый PR и пройти ревью",
    "Инженерные практики",
    "Junior",
    None,
    10,
    GoalStatus.IN_PROGRESS,
)
