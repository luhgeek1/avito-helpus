from datetime import date
from typing import Any, Self
from uuid import UUID

from pydantic import Field

from app.api.schemas.base import MoscowDateTime, RequestModel, ResponseModel
from app.domain.plan import (
    STAGE_TITLES,
    Audience,
    Confirmation,
    ItemStatus,
    PlanItemView,
    PlanOverview,
    QuizResult,
    Stage,
    Transition,
    WaitingReason,
)


class QuizQuestionOut(ResponseModel):
    question: str
    options: list[str]


class PlanItemOut(ResponseModel):
    id: UUID
    slug: str
    stage: Stage
    title: str
    description: str
    category: str
    audience: Audience
    confirmation: Confirmation
    action: dict[str, Any] | None = Field(description="What Orbi can do for this step")
    quiz: list[QuizQuestionOut] = Field(description="Questions only; answers stay on the server")
    doc_slugs: list[str]
    needs_laptop: bool
    status: ItemStatus
    due_date: date
    overdue: bool
    started_at: MoscowDateTime | None
    completed_at: MoscowDateTime | None
    waiting_reason: WaitingReason | None
    blocked_reason: str | None
    review_comment: str | None
    request_id: UUID | None

    @classmethod
    def from_domain(cls, item: PlanItemView, today: date) -> Self:
        data = {f: getattr(item, f) for f in item.__dataclass_fields__}
        data["action"] = dict(item.action) if item.action else None
        data["quiz"] = [{"question": q.question, "options": list(q.options)} for q in item.quiz]
        data["doc_slugs"] = list(item.doc_slugs)
        data["overdue"] = item.is_overdue(today)
        return cls.model_validate(data)


class StageOut(ResponseModel):
    stage: Stage
    title: str
    due_date: date
    total: int
    done: int
    percent: int
    items: list[PlanItemOut]


class PlanOut(ResponseModel):
    start_date: date
    today: date
    current_stage: Stage
    current_stage_title: str
    total: int
    done: int
    overdue: int
    percent: int
    next_steps: list[PlanItemOut]
    stages: list[StageOut]

    @classmethod
    def from_domain(cls, plan: PlanOverview) -> Self:
        return cls(
            start_date=plan.start_date,
            today=plan.today,
            current_stage=plan.current_stage,
            current_stage_title=STAGE_TITLES[plan.current_stage],
            total=plan.total,
            done=plan.done,
            overdue=plan.overdue,
            percent=plan.percent,
            next_steps=[PlanItemOut.from_domain(i, plan.today) for i in plan.next_steps],
            stages=[
                StageOut(
                    stage=s.stage,
                    title=s.title,
                    due_date=s.due_date,
                    total=s.total,
                    done=s.done,
                    percent=s.percent,
                    items=[PlanItemOut.from_domain(i, plan.today) for i in s.items],
                )
                for s in plan.stages
            ],
        )


class TransitionIn(RequestModel):
    transition: Transition = Field(description="start, complete, submit_review, block, unblock")
    comment: str | None = Field(None, max_length=500)


class ReviewIn(RequestModel):
    transition: Transition = Field(
        description="approve or return for review items; start/complete for mentor tasks"
    )
    comment: str | None = Field(None, max_length=1000)


class QuizIn(RequestModel):
    answers: list[int] = Field(..., max_length=20, description="Chosen option index per question")


class QuizOut(ResponseModel):
    passed: bool
    wrong: list[int]
    item: PlanItemOut

    @classmethod
    def build(cls, result: QuizResult, item: PlanItemView, today: date) -> Self:
        return cls(
            passed=result.passed,
            wrong=list(result.wrong),
            item=PlanItemOut.from_domain(item, today),
        )
