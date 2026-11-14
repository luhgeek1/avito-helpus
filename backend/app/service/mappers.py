from collections.abc import Mapping, Sequence
from uuid import UUID

from app.db.models import (
    AccessResource,
    Escalation,
    PlanItem,
    PlanTemplateItem,
    RequestEvent,
    ServiceRequest,
    Team,
    User,
)
from app.db.repositories.knowledge import ChunkRow
from app.domain.escalations import EscalationView
from app.domain.knowledge import SearchHit
from app.domain.plan import PlanItemView, QuizQuestion
from app.domain.requests import AccessResource as AccessResourceView
from app.domain.requests import RequestEventView, RequestView
from app.domain.users import MemberLinks, Person, PersonRef, TeamRef


def to_person_ref(user: User | None) -> PersonRef | None:
    if user is None:
        return None
    return PersonRef(id=user.id, full_name=user.full_name, title=user.title, email=user.email)


def to_team_ref(team: Team | None) -> TeamRef | None:
    if team is None:
        return None
    return TeamRef(id=team.id, slug=team.slug, name=team.name, channel=team.channel)


def to_person(user: User, *, team: Team | None, people: Mapping[UUID, User]) -> Person:
    return Person(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        title=user.title,
        role=user.role,
        track=user.track,
        start_date=user.start_date,
        team=to_team_ref(team),
        mentor=to_person_ref(people.get(user.mentor_id)) if user.mentor_id else None,
        lead=to_person_ref(people.get(user.lead_id)) if user.lead_id else None,
        hrbp=to_person_ref(people.get(user.hrbp_id)) if user.hrbp_id else None,
    )


def to_links(user: User) -> MemberLinks:
    return MemberLinks(
        id=user.id,
        team_id=user.team_id,
        mentor_id=user.mentor_id,
        lead_id=user.lead_id,
        hrbp_id=user.hrbp_id,
    )


def to_plan_item(item: PlanItem, template: PlanTemplateItem) -> PlanItemView:
    quiz = tuple(
        QuizQuestion(question=q["question"], options=tuple(q["options"]), answer=int(q["answer"]))
        for q in template.quiz or []
    )
    return PlanItemView(
        id=item.id,
        user_id=item.user_id,
        slug=template.slug,
        stage=template.stage,
        position=template.position,
        title=template.title,
        description=template.description,
        category=template.category,
        audience=template.audience,
        confirmation=template.confirmation,
        action=template.action,
        quiz=quiz,
        doc_slugs=tuple(template.doc_slugs),
        needs_laptop=template.needs_laptop,
        status=item.status,
        due_date=item.due_date,
        started_at=item.started_at,
        completed_at=item.completed_at,
        waiting_reason=item.waiting_reason,
        blocked_reason=item.blocked_reason,
        review_comment=item.review_comment,
        request_id=item.request_id,
    )


def to_resource(resource: AccessResource) -> AccessResourceView:
    return AccessResourceView(
        id=resource.id,
        slug=resource.slug,
        name=resource.name,
        system=resource.system,
        description=resource.description,
        team_id=resource.team_id,
        sensitivity=resource.sensitivity,
        approver_role=resource.approver_role,
        default_level=resource.default_level,
        aliases=tuple(resource.aliases),
    )


def to_request(request: ServiceRequest, events: Sequence[RequestEvent] = ()) -> RequestView:
    return RequestView(
        id=request.id,
        user_id=request.user_id,
        kind=request.kind,
        status=request.status,
        title=request.title,
        external_id=request.external_id,
        payload=request.payload,
        approver=request.approver,
        decision_comment=request.decision_comment,
        plan_item_id=request.plan_item_id,
        sla_due_at=request.sla_due_at,
        created_at=request.created_at,
        updated_at=request.updated_at,
        history=[
            RequestEventView(status=e.status, source=e.source, note=e.note, created_at=e.created_at)
            for e in events
            if e.request_id == request.id
        ],
    )


def to_escalation(
    escalation: Escalation, people: Mapping[UUID, User], faq_slug: str | None = None
) -> EscalationView:
    asker = people.get(escalation.user_id)
    assignee = people.get(escalation.assignee_id)
    answered_by = people.get(escalation.answered_by_id) if escalation.answered_by_id else None
    return EscalationView(
        id=escalation.id,
        user_id=escalation.user_id,
        user_name=asker.full_name if asker else "",
        assignee_id=escalation.assignee_id,
        assignee_name=assignee.full_name if assignee else "",
        level=escalation.level,
        kind=escalation.kind,
        status=escalation.status,
        question=escalation.question,
        context=escalation.context,
        answer=escalation.answer,
        answered_by_name=answered_by.full_name if answered_by else None,
        answered_at=escalation.answered_at,
        due_at=escalation.due_at,
        faq_document_slug=faq_slug,
        created_at=escalation.created_at,
    )


def to_hit(row: ChunkRow, score: float) -> SearchHit:
    return SearchHit(
        chunk_id=row.chunk.id,
        document_id=row.document.id,
        document_slug=row.document.slug,
        document_title=row.document.title,
        heading=row.chunk.heading,
        content=row.chunk.content,
        scope=row.document.scope,
        team_name=row.team_name,
        source_label=row.document.source_label,
        source_url=row.document.source_url,
        updated_at=row.document.doc_updated_at,
        topic=row.chunk.topic,
        score=score,
    )
