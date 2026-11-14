from datetime import date, timedelta
from uuid import uuid4

import pytest

from app.core.errors import ForbiddenError
from app.domain.plan import (
    Audience,
    Confirmation,
    ItemStatus,
    PlanItemView,
    PlanTransitionError,
    QuizQuestion,
    QuizRequiredError,
    ReviewRequiredError,
    Stage,
    Transition,
    WaitingReason,
    build_overview,
    check_quiz,
    current_stage,
    due_date,
    next_status,
    pick_next_steps,
)

TODAY = date(2026, 11, 14)


def item(
    *,
    status: ItemStatus = ItemStatus.TODO,
    stage: Stage = Stage.WEEK_1,
    due: date = TODAY,
    audience: Audience = Audience.INTERN,
    position: int = 1,
    title: str = "Шаг",
) -> PlanItemView:
    return PlanItemView(
        id=uuid4(),
        user_id=uuid4(),
        slug=title,
        stage=stage,
        position=position,
        title=title,
        description="",
        category="org",
        audience=audience,
        confirmation=Confirmation.SELF,
        action=None,
        quiz=(),
        doc_slugs=(),
        needs_laptop=False,
        status=status,
        due_date=due,
        started_at=None,
        completed_at=None,
        waiting_reason=None,
        blocked_reason=None,
        review_comment=None,
        request_id=None,
    )


def move(
    status: ItemStatus,
    transition: Transition,
    *,
    confirmation: Confirmation = Confirmation.SELF,
    audience: Audience = Audience.INTERN,
    waiting: WaitingReason | None = None,
    reviewer: bool = False,
) -> ItemStatus:
    return next_status(
        status=status,
        transition=transition,
        confirmation=confirmation,
        audience=audience,
        waiting_reason=waiting,
        by_reviewer=reviewer,
    )


def test_stages_follow_the_internship_calendar() -> None:
    start = date(2026, 11, 1)
    assert current_stage(start, start) is Stage.WEEK_1
    assert current_stage(start, start + timedelta(days=10)) is Stage.WEEK_2
    assert current_stage(start, start + timedelta(days=40)) is Stage.MONTH_2
    assert current_stage(start, start + timedelta(days=400)) is Stage.AFTER_3_MONTHS
    assert due_date(start, Stage.WEEK_1) == date(2026, 11, 7)


def test_self_confirmed_step_goes_todo_in_progress_done() -> None:
    assert move(ItemStatus.TODO, Transition.START) is ItemStatus.IN_PROGRESS
    assert move(ItemStatus.IN_PROGRESS, Transition.COMPLETE) is ItemStatus.DONE
    assert move(ItemStatus.TODO, Transition.COMPLETE) is ItemStatus.DONE


def test_block_and_unblock() -> None:
    assert move(ItemStatus.IN_PROGRESS, Transition.BLOCK) is ItemStatus.BLOCKED
    assert move(ItemStatus.BLOCKED, Transition.UNBLOCK) is ItemStatus.IN_PROGRESS


def test_done_step_cannot_change() -> None:
    with pytest.raises(PlanTransitionError):
        move(ItemStatus.DONE, Transition.COMPLETE)


def test_quiz_step_is_not_completed_by_hand() -> None:
    with pytest.raises(QuizRequiredError):
        move(ItemStatus.TODO, Transition.COMPLETE, confirmation=Confirmation.QUIZ)


def test_mentor_step_needs_review() -> None:
    with pytest.raises(ReviewRequiredError):
        move(ItemStatus.IN_PROGRESS, Transition.COMPLETE, confirmation=Confirmation.MENTOR)
    assert (
        move(ItemStatus.IN_PROGRESS, Transition.SUBMIT_REVIEW, confirmation=Confirmation.MENTOR)
        is ItemStatus.WAITING
    )


def test_only_mentor_steps_go_to_review() -> None:
    with pytest.raises(PlanTransitionError):
        move(ItemStatus.TODO, Transition.SUBMIT_REVIEW)


def test_reviewer_approves_or_returns() -> None:
    review = WaitingReason.MENTOR_REVIEW
    assert (
        move(ItemStatus.WAITING, Transition.APPROVE, waiting=review, reviewer=True)
        is ItemStatus.DONE
    )
    assert (
        move(ItemStatus.WAITING, Transition.RETURN, waiting=review, reviewer=True)
        is ItemStatus.IN_PROGRESS
    )


def test_intern_cannot_approve_own_step() -> None:
    with pytest.raises(ForbiddenError):
        move(ItemStatus.WAITING, Transition.APPROVE, waiting=WaitingReason.MENTOR_REVIEW)


def test_request_wait_is_not_approved_by_mentor() -> None:
    with pytest.raises(PlanTransitionError):
        move(ItemStatus.WAITING, Transition.APPROVE, waiting=WaitingReason.REQUEST, reviewer=True)


def test_mentor_tasks_are_done_by_the_mentor_only() -> None:
    with pytest.raises(ForbiddenError):
        move(ItemStatus.TODO, Transition.COMPLETE, audience=Audience.MENTOR)
    assert (
        move(ItemStatus.TODO, Transition.COMPLETE, audience=Audience.MENTOR, reviewer=True)
        is ItemStatus.DONE
    )


def test_quiz_checks_every_answer() -> None:
    questions = (
        QuizQuestion("q1", ("a", "b"), 1),
        QuizQuestion("q2", ("a", "b"), 0),
    )
    assert check_quiz(questions, [1, 0]).passed
    assert check_quiz(questions, [1, 1]).wrong == (1,)
    assert check_quiz(questions, [1]).wrong == (0, 1)


def test_next_steps_put_overdue_first_and_skip_waiting_and_mentor_items() -> None:
    overdue = item(title="Просрочен", due=TODAY - timedelta(days=2))
    soon = item(title="Скоро", due=TODAY + timedelta(days=1))
    started = item(title="Начат", due=TODAY + timedelta(days=1), status=ItemStatus.IN_PROGRESS)
    later = item(title="Позже", due=TODAY + timedelta(days=20), stage=Stage.MONTH_1)
    waiting = item(title="Ждёт", status=ItemStatus.WAITING)
    mentor = item(title="Наставнику", audience=Audience.MENTOR)

    steps = pick_next_steps([later, soon, waiting, mentor, started, overdue], TODAY)

    assert [s.title for s in steps] == ["Просрочен", "Начат", "Скоро"]


def test_overview_counts_progress_per_stage() -> None:
    items = [
        item(status=ItemStatus.DONE),
        item(position=2),
        item(stage=Stage.WEEK_2, due=TODAY - timedelta(days=1)),
    ]
    plan = build_overview(user_id=uuid4(), start=TODAY, today=TODAY, items=items)

    assert (plan.done, plan.total, plan.overdue, plan.percent) == (1, 3, 1, 33)
    assert plan.stages[0].percent == 50
    assert plan.stages[-1].percent == 100
