from dataclasses import dataclass
from uuid import UUID

from app.core.clock import today
from app.db.models import User
from app.db.uow import UnitOfWork
from app.domain.escalations import EscalationKind, EscalationView
from app.domain.plan import (
    STAGE_TITLES,
    Audience,
    ItemStatus,
    PlanItemView,
    PlanOverview,
    WaitingReason,
    build_overview,
)
from app.domain.requests import RequestView
from app.domain.users import CurrentUser, Person, Role
from app.service.mappers import to_escalation, to_person, to_plan_item, to_request
from app.service.people import PeopleService

ATTENTION_OVERDUE = 2


@dataclass(frozen=True, slots=True)
class MenteeSummary:
    person: Person
    internship_day: int | None
    stage_title: str
    percent: int
    done: int
    total: int
    overdue: int
    blocked: list[PlanItemView]
    awaiting_review: list[PlanItemView]
    mentor_tasks: list[PlanItemView]
    open_requests: int
    open_questions: int

    @property
    def needs_attention(self) -> bool:
        return bool(self.blocked or self.awaiting_review or self.open_questions) or (
            self.overdue >= ATTENTION_OVERDUE
        )


@dataclass(frozen=True, slots=True)
class MenteeDetail:
    summary: MenteeSummary
    plan: PlanOverview
    requests: list[RequestView]
    questions: list[EscalationView]


class MentorService:
    """What a mentor, lead or HRBP sees about the interns linked to them (ABAC-scoped)."""

    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def mentees(self, actor: CurrentUser) -> list[MenteeSummary]:
        interns = list(await self._uow.people.interns_visible_to(actor.id, actor.role))
        return [summary for summary, _ in await self._summaries(interns, actor)]

    async def mentee(self, actor: CurrentUser, mentee_id: UUID) -> MenteeDetail:
        user, _ = await PeopleService(self._uow).member(actor, mentee_id)
        ((summary, plan),) = await self._summaries([user], actor)
        rows = await self._uow.requests.for_user(user.id)
        events = await self._uow.requests.events([r.id for r in rows])
        questions = [
            q
            for q in await self._uow.escalations.asked_by(user.id)
            if _question_visible(q.kind, q.user_id, q.assignee_id, actor)
        ]
        people = await self._uow.people.get_many(
            [q.user_id for q in questions]
            + [q.assignee_id for q in questions]
            + [q.answered_by_id for q in questions]
        )
        return MenteeDetail(
            summary=summary,
            plan=plan,
            requests=[to_request(r, events) for r in rows],
            questions=[to_escalation(q, people) for q in questions],
        )

    async def _summaries(
        self, interns: list[User], actor: CurrentUser
    ) -> list[tuple[MenteeSummary, PlanOverview]]:
        ids = [u.id for u in interns]
        rows = await self._uow.plan.items_for_users(ids)
        requests = await self._uow.requests.open_for_users(ids)
        questions = [
            q
            for q in await self._uow.escalations.open_for_users(ids)
            if _question_visible(q.kind, q.user_id, q.assignee_id, actor)
        ]
        teams = await self._uow.people.teams([u.team_id for u in interns])
        people = await self._uow.people.get_many(
            [u.mentor_id for u in interns]
            + [u.lead_id for u in interns]
            + [u.hrbp_id for u in interns]
        )
        on = today()
        result = []
        for intern in interns:
            items = [to_plan_item(i, t) for i, t in rows if i.user_id == intern.id]
            plan = build_overview(
                user_id=intern.id, start=intern.start_date or on, today=on, items=items
            )
            person = to_person(
                intern, team=teams.get(intern.team_id) if intern.team_id else None, people=people
            )
            summary = MenteeSummary(
                person=person,
                internship_day=person.internship_day(on),
                stage_title=STAGE_TITLES[plan.current_stage],
                percent=plan.percent,
                done=plan.done,
                total=plan.total,
                overdue=plan.overdue,
                blocked=[i for i in items if i.status is ItemStatus.BLOCKED],
                awaiting_review=[
                    i
                    for i in items
                    if i.status is ItemStatus.WAITING
                    and i.waiting_reason is WaitingReason.MENTOR_REVIEW
                ],
                mentor_tasks=[
                    i
                    for i in items
                    if i.audience is Audience.MENTOR and i.status is not ItemStatus.DONE
                ],
                open_requests=sum(1 for r in requests if r.user_id == intern.id),
                open_questions=sum(1 for q in questions if q.user_id == intern.id),
            )
            result.append((summary, plan))
        return result


def _question_visible(
    kind: EscalationKind, user_id: UUID, assignee_id: UUID, actor: CurrentUser
) -> bool:
    return (
        kind is not EscalationKind.SENSITIVE
        or actor.role is Role.ADMIN
        or actor.id in {user_id, assignee_id}
    )
