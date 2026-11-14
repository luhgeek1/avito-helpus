from datetime import date, datetime
from typing import Any, Literal, Self
from uuid import UUID

from pydantic import Field

from app.api.schemas.base import RequestModel, ResponseModel
from app.api.schemas.people import PersonOut
from app.api.schemas.plan import PlanItemOut, PlanOut
from app.api.schemas.requests import RequestOut
from app.domain.assistant import ChatMessageView, ConversationSummary, Decision
from app.domain.escalations import EscalationKind, EscalationLevel, EscalationStatus, EscalationView
from app.domain.knowledge import ConflictView, DocKind, DocScope, SearchHit, SearchResult
from app.service.knowledge import DocumentView
from app.service.mentor import MenteeDetail, MenteeSummary
from app.service.ops import MetricsSummary

# ---- knowledge ---------------------------------------------------------------------------------


class SourceOut(ResponseModel):
    document_slug: str
    document_title: str
    heading: str
    content: str
    scope: DocScope
    team_name: str | None
    source_label: str
    source_url: str | None
    updated_at: date
    stale: bool

    @classmethod
    def from_domain(cls, hit: SearchHit, today: date) -> Self:
        data = {f: getattr(hit, f) for f in hit.__dataclass_fields__}
        data["stale"] = hit.is_stale(today)
        return cls.model_validate(data)


class ConflictOut(ResponseModel):
    id: UUID
    topic: str
    summary: str
    company: SourceOut
    team: SourceOut

    @classmethod
    def from_domain(cls, conflict: ConflictView, today: date) -> Self:
        return cls(
            id=conflict.id,
            topic=conflict.topic,
            summary=conflict.summary,
            company=SourceOut.from_domain(conflict.company, today),
            team=SourceOut.from_domain(conflict.team, today),
        )


class SearchOut(ResponseModel):
    query: str
    mode: str
    sources: list[SourceOut]
    conflicts: list[ConflictOut]

    @classmethod
    def from_domain(cls, result: SearchResult, today: date) -> Self:
        return cls(
            query=result.query,
            mode=result.mode,
            sources=[SourceOut.from_domain(h, today) for h in result.hits],
            conflicts=[ConflictOut.from_domain(c, today) for c in result.conflicts],
        )


class DocumentOut(ResponseModel):
    slug: str
    title: str
    kind: DocKind
    scope: DocScope
    team_name: str | None
    owner: str
    source_label: str
    source_url: str | None
    updated_at: date
    body: str

    @classmethod
    def from_domain(cls, view: DocumentView) -> Self:
        return cls.model_validate(view)


class ConflictReportIn(RequestModel):
    note: str | None = Field(None, max_length=1000)


# ---- escalations -------------------------------------------------------------------------------


class EscalationOut(ResponseModel):
    id: UUID
    user_id: UUID
    user_name: str
    assignee_id: UUID
    assignee_name: str
    level: EscalationLevel
    kind: EscalationKind
    status: EscalationStatus
    question: str
    context: dict[str, Any]
    answer: str | None
    answered_by_name: str | None
    answered_at: datetime | None
    due_at: datetime
    faq_document_slug: str | None
    created_at: datetime

    @classmethod
    def from_domain(cls, view: EscalationView) -> Self:
        data = {f: getattr(view, f) for f in view.__dataclass_fields__}
        data["context"] = dict(view.context)
        return cls.model_validate(data)


class EscalationIn(RequestModel):
    question: str = Field(..., min_length=5, max_length=2000)
    kind: EscalationKind = EscalationKind.QUESTION


class AnswerIn(RequestModel):
    answer: str = Field(..., min_length=2, max_length=4000)
    publish_to_faq: bool = False


# ---- mentor ------------------------------------------------------------------------------------


class MenteeOut(ResponseModel):
    person: PersonOut
    internship_day: int | None
    stage_title: str
    percent: int
    done: int
    total: int
    overdue: int
    blocked: list[PlanItemOut]
    awaiting_review: list[PlanItemOut]
    mentor_tasks: list[PlanItemOut]
    open_requests: int
    open_questions: int
    needs_attention: bool

    @classmethod
    def from_domain(cls, summary: MenteeSummary, today: date) -> Self:
        return cls(
            person=PersonOut.from_domain(summary.person),
            internship_day=summary.internship_day,
            stage_title=summary.stage_title,
            percent=summary.percent,
            done=summary.done,
            total=summary.total,
            overdue=summary.overdue,
            blocked=[PlanItemOut.from_domain(i, today) for i in summary.blocked],
            awaiting_review=[PlanItemOut.from_domain(i, today) for i in summary.awaiting_review],
            mentor_tasks=[PlanItemOut.from_domain(i, today) for i in summary.mentor_tasks],
            open_requests=summary.open_requests,
            open_questions=summary.open_questions,
            needs_attention=summary.needs_attention,
        )


class MenteeDetailOut(ResponseModel):
    summary: MenteeOut
    plan: PlanOut
    requests: list[RequestOut]
    questions: list[EscalationOut]

    @classmethod
    def from_domain(cls, detail: MenteeDetail, today: date) -> Self:
        return cls(
            summary=MenteeOut.from_domain(detail.summary, today),
            plan=PlanOut.from_domain(detail.plan),
            requests=[RequestOut.from_domain(r) for r in detail.requests],
            questions=[EscalationOut.from_domain(q) for q in detail.questions],
        )


# ---- chat --------------------------------------------------------------------------------------


class ConversationOut(ResponseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, summary: ConversationSummary) -> Self:
        return cls.model_validate(summary)


class ChatMessageOut(ResponseModel):
    id: UUID
    role: str
    parts: list[dict[str, Any]] = Field(
        description="AI SDK UI parts: text, data-sources, data-action, ..."
    )
    feedback: str | None
    created_at: datetime

    @classmethod
    def from_domain(cls, view: ChatMessageView) -> Self:
        return cls.model_validate(view)


class HistoryOut(ResponseModel):
    conversation: ConversationOut
    messages: list[ChatMessageOut]


class MessageIn(RequestModel):
    text: str = Field(..., min_length=1, max_length=4000)


class DecisionIn(RequestModel):
    decision: Decision
    edits: dict[str, Any] = Field(default_factory=dict, description="Changed editable card fields")


class FeedbackIn(RequestModel):
    rating: Literal["up", "down"]
    comment: str | None = Field(None, max_length=1000)


class AssistantStatusOut(ResponseModel):
    mode: str
    model: str | None
    embeddings: bool


# ---- notifications and ops ---------------------------------------------------------------------


class NotificationOut(ResponseModel):
    id: UUID
    kind: str
    title: str
    body: str
    link: str | None
    payload: dict[str, Any]
    read_at: datetime | None
    created_at: datetime


class NotificationsOut(ResponseModel):
    unread: int
    items: list[NotificationOut]


class MetricsOut(ResponseModel):
    period_days: int
    access_requests_approved: int
    access_hours_avg: float | None
    questions_total: int
    escalations_total: int
    resolved_without_mentor_share: float | None
    escalations_resolved: int
    escalation_hours_avg: float | None
    plan_on_time_share: float | None
    feedback_up: int
    feedback_down: int
    chat_by_variant: dict[str, int]
    fallbacks: int

    @classmethod
    def from_domain(cls, summary: MetricsSummary) -> Self:
        return cls.model_validate(summary)


class FlagOut(ResponseModel):
    key: str
    enabled: bool
    rollout_percent: int
    variants: list[str]
    description: str


class FlagUpdateIn(RequestModel):
    enabled: bool
    rollout_percent: int = Field(..., ge=0, le=100)
    variants: list[str] = Field(default_factory=list, max_length=4)


class AuditOut(ResponseModel):
    id: UUID
    actor_id: UUID | None
    action: str
    target_type: str
    target_id: str | None
    details: dict[str, Any]
    created_at: datetime


class UiEventIn(RequestModel):
    name: str = Field(..., max_length=64)
    properties: dict[str, str | int | float | bool | None] = Field(default_factory=dict)


class CorpWebhookIn(RequestModel):
    """Decision pushed by a corporate service (signed with HMAC, see X-Corp-Signature)."""

    event: Literal["request.status_changed"]
    service: Literal["access", "absence", "itsupport"]
    request_id: str = Field(..., max_length=64)
    status: Literal["approved", "rejected", "cancelled", "pending_approval"]
    comment: str | None = Field(None, max_length=2000)
