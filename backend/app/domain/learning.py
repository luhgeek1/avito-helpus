"""Courses on the learning platform and goals of the individual development plan (IDP)."""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from enum import StrEnum

from app.core.errors import ErrorCode, NotFoundError

DEADLINE_SOON_DAYS = 3


class CourseStatus(StrEnum):
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    PENDING_APPROVAL = "pending_approval"


COURSE_STATUS_TITLES: Mapping[CourseStatus, str] = {
    CourseStatus.ASSIGNED: "назначен",
    CourseStatus.IN_PROGRESS: "в процессе",
    CourseStatus.COMPLETED: "пройден",
    CourseStatus.OVERDUE: "просрочен",
    CourseStatus.PENDING_APPROVAL: "ждёт согласования",
}


class GoalStatus(StrEnum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    DONE = "done"


GOAL_STATUS_TITLES: Mapping[GoalStatus, str] = {
    GoalStatus.NOT_STARTED: "не начата",
    GoalStatus.IN_PROGRESS: "в работе",
    GoalStatus.DONE: "достигнута",
}


@dataclass(frozen=True, slots=True)
class Course:
    id: str
    title: str
    provider: str
    hours: int
    mandatory: bool
    due: date | None
    progress: int
    status: CourseStatus
    url: str

    @property
    def status_title(self) -> str:
        return COURSE_STATUS_TITLES[self.status]

    def deadline_soon(self, today: date) -> bool:
        return (
            self.status in {CourseStatus.ASSIGNED, CourseStatus.IN_PROGRESS}
            and self.due is not None
            and 0 <= (self.due - today).days <= DEADLINE_SOON_DAYS
        )


@dataclass(frozen=True, slots=True)
class CatalogCourse:
    id: str
    title: str
    provider: str
    hours: int
    external: bool
    enrolled: bool


@dataclass(frozen=True, slots=True)
class DevelopmentGoal:
    goal: str
    competency: str
    level: str
    due: date | None
    progress: int
    status: GoalStatus

    @property
    def status_title(self) -> str:
        return GOAL_STATUS_TITLES[self.status]


class CourseNotFoundError(NotFoundError):
    error_code = ErrorCode.NOT_FOUND
    default_detail = "Такого курса в каталоге нет — поищи по теме, например «курс по Go»"
