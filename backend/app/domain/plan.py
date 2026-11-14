from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from enum import StrEnum
from typing import Any
from uuid import UUID

from app.core.errors import ConflictError, ErrorCode, ForbiddenError, NotFoundError


class Stage(StrEnum):
    WEEK_1 = "week_1"
    WEEK_2 = "week_2"
    MONTH_1 = "month_1"
    MONTH_2 = "month_2"
    MONTH_3 = "month_3"
    AFTER_3_MONTHS = "after_3_months"


STAGE_ORDER: tuple[Stage, ...] = tuple(Stage)

STAGE_TITLES: Mapping[Stage, str] = {
    Stage.WEEK_1: "Первая неделя",
    Stage.WEEK_2: "Вторая неделя",
    Stage.MONTH_1: "Первый месяц",
    Stage.MONTH_2: "Второй месяц",
    Stage.MONTH_3: "Третий месяц",
    Stage.AFTER_3_MONTHS: "После трёх месяцев",
}

# Deadline of each stage counted from the first internship day (inclusive of that day).
STAGE_DEADLINE_DAYS: Mapping[Stage, int] = {
    Stage.WEEK_1: 7,
    Stage.WEEK_2: 14,
    Stage.MONTH_1: 30,
    Stage.MONTH_2: 60,
    Stage.MONTH_3: 90,
    Stage.AFTER_3_MONTHS: 180,
}


class ItemStatus(StrEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    WAITING = "waiting"
    BLOCKED = "blocked"
    DONE = "done"


class Confirmation(StrEnum):
    SELF = "self"
    QUIZ = "quiz"
    MENTOR = "mentor"


class Audience(StrEnum):
    """Who acts on the item: the intern, or the mentor on the intern's behalf."""

    INTERN = "intern"
    MENTOR = "mentor"


class WaitingReason(StrEnum):
    MENTOR_REVIEW = "mentor_review"
    REQUEST = "request"


class ActionKind(StrEnum):
    """What Orbi can do for an item: the "do it with Orbi" button."""

    ACCESS_REQUEST = "access_request"
    ABSENCE_REQUEST = "absence_request"
    EQUIPMENT = "equipment"
    ASK_MENTOR = "ask_mentor"
    LEARN = "learn"


class Transition(StrEnum):
    START = "start"
    COMPLETE = "complete"
    SUBMIT_REVIEW = "submit_review"
    BLOCK = "block"
    UNBLOCK = "unblock"
    APPROVE = "approve"
    RETURN = "return"


REVIEWER_TRANSITIONS = frozenset({Transition.APPROVE, Transition.RETURN})


@dataclass(frozen=True, slots=True)
class QuizQuestion:
    question: str
    options: tuple[str, ...]
    answer: int


@dataclass(frozen=True, slots=True)
class PlanItemView:
    id: UUID
    user_id: UUID
    slug: str
    stage: Stage
    position: int
    title: str
    description: str
    category: str
    audience: Audience
    confirmation: Confirmation
    action: Mapping[str, Any] | None
    quiz: tuple[QuizQuestion, ...]
    doc_slugs: tuple[str, ...]
    needs_laptop: bool
    status: ItemStatus
    due_date: date
    started_at: datetime | None
    completed_at: datetime | None
    waiting_reason: WaitingReason | None
    blocked_reason: str | None
    review_comment: str | None
    request_id: UUID | None

    def is_overdue(self, today: date) -> bool:
        return self.status is not ItemStatus.DONE and self.due_date < today


@dataclass(frozen=True, slots=True)
class StageProgress:
    stage: Stage
    title: str
    due_date: date
    total: int
    done: int
    items: list[PlanItemView] = field(default_factory=list)

    @property
    def percent(self) -> int:
        return round(100 * self.done / self.total) if self.total else 100


@dataclass(frozen=True, slots=True)
class PlanOverview:
    user_id: UUID
    start_date: date
    today: date
    current_stage: Stage
    stages: list[StageProgress]
    next_steps: list[PlanItemView]
    total: int
    done: int
    overdue: int

    @property
    def percent(self) -> int:
        return round(100 * self.done / self.total) if self.total else 100


@dataclass(frozen=True, slots=True)
class QuizResult:
    passed: bool
    wrong: tuple[int, ...]


class PlanItemNotFoundError(NotFoundError):
    error_code = ErrorCode.PLAN_ITEM_NOT_FOUND
    default_detail = "Plan item not found"


class PlanTransitionError(ConflictError):
    error_code = ErrorCode.PLAN_TRANSITION_INVALID
    default_detail = "This step can't change status that way"


class QuizRequiredError(ConflictError):
    error_code = ErrorCode.PLAN_QUIZ_REQUIRED
    default_detail = "This step is confirmed by a short quiz"


class ReviewRequiredError(ConflictError):
    error_code = ErrorCode.PLAN_REVIEW_REQUIRED
    default_detail = "This step is confirmed by your mentor: submit it for review"


def due_date(start: date, stage: Stage) -> date:
    return start + timedelta(days=STAGE_DEADLINE_DAYS[stage] - 1)


def current_stage(start: date, today: date) -> Stage:
    day = (today - start).days + 1
    for stage in STAGE_ORDER:
        if day <= STAGE_DEADLINE_DAYS[stage]:
            return stage
    return Stage.AFTER_3_MONTHS


# (status, transition) -> new status. Transitions that need a specific confirmation kind are
# checked separately in `next_status`, so the table stays a plain state machine.
_TRANSITIONS: Mapping[tuple[ItemStatus, Transition], ItemStatus] = {
    (ItemStatus.TODO, Transition.START): ItemStatus.IN_PROGRESS,
    (ItemStatus.TODO, Transition.COMPLETE): ItemStatus.DONE,
    (ItemStatus.IN_PROGRESS, Transition.COMPLETE): ItemStatus.DONE,
    (ItemStatus.TODO, Transition.SUBMIT_REVIEW): ItemStatus.WAITING,
    (ItemStatus.IN_PROGRESS, Transition.SUBMIT_REVIEW): ItemStatus.WAITING,
    (ItemStatus.TODO, Transition.BLOCK): ItemStatus.BLOCKED,
    (ItemStatus.IN_PROGRESS, Transition.BLOCK): ItemStatus.BLOCKED,
    (ItemStatus.BLOCKED, Transition.UNBLOCK): ItemStatus.IN_PROGRESS,
    (ItemStatus.WAITING, Transition.APPROVE): ItemStatus.DONE,
    (ItemStatus.WAITING, Transition.RETURN): ItemStatus.IN_PROGRESS,
}


def next_status(
    *,
    status: ItemStatus,
    transition: Transition,
    confirmation: Confirmation,
    audience: Audience,
    waiting_reason: WaitingReason | None,
    by_reviewer: bool,
) -> ItemStatus:
    """Validate one plan transition and return the new status (raises on anything illegal)."""
    if transition in REVIEWER_TRANSITIONS:
        if not by_reviewer:
            raise ForbiddenError("Only the mentor confirms this step")
        if waiting_reason is not WaitingReason.MENTOR_REVIEW:
            raise PlanTransitionError()
    elif audience is Audience.MENTOR and not by_reviewer:
        raise ForbiddenError("This step is done by the mentor")

    new_status = _TRANSITIONS.get((status, transition))
    if new_status is None:
        raise PlanTransitionError()

    if transition is Transition.COMPLETE and audience is Audience.INTERN:
        if confirmation is Confirmation.QUIZ:
            raise QuizRequiredError()
        if confirmation is Confirmation.MENTOR:
            raise ReviewRequiredError()
    if transition is Transition.SUBMIT_REVIEW and confirmation is not Confirmation.MENTOR:
        raise PlanTransitionError("This step doesn't need a mentor review")
    return new_status


def check_quiz(questions: Sequence[QuizQuestion], answers: Sequence[int]) -> QuizResult:
    if len(answers) != len(questions):
        return QuizResult(passed=False, wrong=tuple(range(len(questions))))
    wrong = tuple(
        index
        for index, (question, answer) in enumerate(zip(questions, answers, strict=True))
        if question.answer != answer
    )
    return QuizResult(passed=not wrong, wrong=wrong)


_ACTIONABLE = frozenset({ItemStatus.TODO, ItemStatus.IN_PROGRESS})
MAX_NEXT_STEPS = 3


def pick_next_steps(
    items: Iterable[PlanItemView], today: date, *, limit: int = MAX_NEXT_STEPS
) -> list[PlanItemView]:
    """Overdue first, then the earliest deadline, started before new; intern items only."""
    candidates = [
        item for item in items if item.status in _ACTIONABLE and item.audience is Audience.INTERN
    ]
    candidates.sort(
        key=lambda item: (
            not item.is_overdue(today),
            item.due_date,
            item.status is not ItemStatus.IN_PROGRESS,
            STAGE_ORDER.index(item.stage),
            item.position,
        )
    )
    return candidates[:limit]


def build_overview(
    *, user_id: UUID, start: date, today: date, items: Sequence[PlanItemView]
) -> PlanOverview:
    by_stage: dict[Stage, list[PlanItemView]] = {stage: [] for stage in STAGE_ORDER}
    for item in sorted(items, key=lambda i: (STAGE_ORDER.index(i.stage), i.position)):
        by_stage[item.stage].append(item)
    stages = [
        StageProgress(
            stage=stage,
            title=STAGE_TITLES[stage],
            due_date=due_date(start, stage),
            total=len(stage_items),
            done=sum(1 for i in stage_items if i.status is ItemStatus.DONE),
            items=stage_items,
        )
        for stage, stage_items in by_stage.items()
    ]
    return PlanOverview(
        user_id=user_id,
        start_date=start,
        today=today,
        current_stage=current_stage(start, today),
        stages=stages,
        next_steps=pick_next_steps(items, today),
        total=len(items),
        done=sum(1 for i in items if i.status is ItemStatus.DONE),
        overdue=sum(1 for i in items if i.is_overdue(today)),
    )
