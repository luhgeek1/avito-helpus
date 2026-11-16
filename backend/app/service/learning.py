"""Learning platform and IDP: assigned courses, enrollment, deadlines and plan steps."""

import re
from dataclasses import dataclass
from datetime import date

from app.db.models import User
from app.db.uow import UnitOfWork
from app.domain.events import NotificationKind
from app.domain.learning import (
    CatalogCourse,
    Course,
    CourseNotFoundError,
    CourseStatus,
    DevelopmentGoal,
)
from app.domain.plan import ActionKind, ItemStatus
from app.domain.requests import OPEN_STATUSES, RequestKind, RequestSource, RequestView
from app.domain.users import CurrentUser, UserNotFoundError
from app.service.mappers import to_request
from app.service.notify import notify
from app.service.plan import PlanService
from app.service.ports import CorpServices
from app.service.requests import RequestService

LEARNING_SERVICE = "Учебная платформа"
LEAD_APPROVAL = "Руководитель (бюджет обучения)"
_WORD = re.compile(r"[a-zа-яё0-9]+")


@dataclass(frozen=True, slots=True)
class LearningOverview:
    courses: list[Course]
    goals: list[DevelopmentGoal]


@dataclass(frozen=True, slots=True)
class EnrollPreparation:
    course: CatalogCourse | None
    candidates: list[CatalogCourse]
    existing: RequestView | None = None

    @property
    def approver(self) -> str:
        return LEAD_APPROVAL if self.course and self.course.external else LEARNING_SERVICE


def _matches(query: str, course: CatalogCourse) -> bool:
    words = {w[:6] for w in _WORD.findall(query.lower()) if len(w) > 1}
    title = {w[:6] for w in _WORD.findall(course.title.lower())}
    return course.id == query.strip().lower() or bool(words & title)


class LearningService:
    def __init__(self, uow: UnitOfWork, corp: CorpServices, *, access_sla_hours: float) -> None:
        self._uow = uow
        self._corp = corp
        self._access_sla = access_sla_hours

    async def overview(self, actor: CurrentUser) -> LearningOverview:
        user = await self._user(actor)
        return LearningOverview(
            courses=await self._corp.courses(employee=user.email),
            goals=await self._corp.development_plan(employee=user.email),
        )

    async def catalog(self, actor: CurrentUser, query: str) -> list[CatalogCourse]:
        user = await self._user(actor)
        return await self._corp.course_catalog(employee=user.email, query=query)

    async def prepare(self, actor: CurrentUser, course: str) -> EnrollPreparation:
        """Find the course the user means; the catalog search is the platform's, then our match."""
        found = await self.catalog(actor, course)
        exact = [c for c in found if _matches(course, c)] or found
        pending = [
            to_request(r)
            for r in await self._uow.requests.for_user(actor.id, kind=RequestKind.LEARNING)
            if r.status in OPEN_STATUSES
        ]
        if len(exact) != 1:
            return EnrollPreparation(course=None, candidates=exact)
        chosen = exact[0]
        existing = next((r for r in pending if r.payload.get("course") == chosen.id), None)
        return EnrollPreparation(course=chosen, candidates=exact, existing=existing)

    async def enroll(
        self,
        actor: CurrentUser,
        *,
        course: str,
        idempotency_key: str,
        source: RequestSource,
    ) -> RequestView:
        prep = await self.prepare(actor, course)
        chosen = prep.course
        if chosen is None or chosen.id != course:
            chosen = next((c for c in await self.catalog(actor, "") if c.id == course), chosen)
        if chosen is None:
            raise CourseNotFoundError()
        step = await self._uow.plan.find_by_action(
            actor.id, kind=ActionKind.LEARN, resource=chosen.id
        )
        if step is not None and step.status not in {ItemStatus.TODO, ItemStatus.IN_PROGRESS}:
            step = None
        return await RequestService(
            self._uow, self._corp, access_sla_hours=self._access_sla
        ).create_tracked(
            actor,
            kind=RequestKind.LEARNING,
            title=f"Курс: {chosen.title}",
            payload={
                "course": chosen.id,
                "title": chosen.title,
                "provider": chosen.provider,
                "hours": chosen.hours,
                "external": chosen.external,
            },
            approver=LEAD_APPROVAL if chosen.external else LEARNING_SERVICE,
            plan_item_id=step.id if step is not None else None,
            idempotency_key=idempotency_key,
            source=source,
        )

    async def follow_up(self, intern: User, *, today: date) -> int:
        """AI-cron for one intern: deadline reminders and plan steps of finished courses."""
        sent = 0
        for course in await self._corp.courses(employee=intern.email):
            if course.status is CourseStatus.COMPLETED:
                step = await self._uow.plan.find_by_action(
                    intern.id, kind=ActionKind.LEARN, resource=course.id
                )
                if step is not None:
                    await PlanService(self._uow).complete_by_system(
                        step.id, note=f"Курс «{course.title}» пройден на учебной платформе"
                    )
                    sent += 1
                continue
            if course.deadline_soon(today) and course.due is not None:
                days = (course.due - today).days
                when = "сегодня" if days == 0 else f"через {days} дн."
                sent += await notify(
                    self._uow,
                    user_id=intern.id,
                    kind=NotificationKind.NUDGE,
                    title=f"Курс «{course.title}»: дедлайн {when}",
                    body=f"Пройдено {course.progress}%. Курс займёт около {course.hours} ч.",
                    link=course.url,
                    payload={"course": course.id},
                    dedupe_key=f"course:{intern.id}:{course.id}:{today.isoformat()}",
                )
        return sent

    async def _user(self, actor: CurrentUser) -> User:
        user = await self._uow.people.get(actor.id)
        if user is None:
            raise UserNotFoundError()
        return user
