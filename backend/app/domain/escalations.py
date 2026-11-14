from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from app.core.errors import ConflictError, ErrorCode, ForbiddenError, NotFoundError


class EscalationLevel(StrEnum):
    MENTOR = "mentor"
    LEAD = "lead"
    HRBP = "hrbp"


LEVEL_ORDER: tuple[EscalationLevel, ...] = tuple(EscalationLevel)

LEVEL_TITLES: Mapping[EscalationLevel, str] = {
    EscalationLevel.MENTOR: "наставник",
    EscalationLevel.LEAD: "руководитель",
    EscalationLevel.HRBP: "HRBP",
}


class EscalationKind(StrEnum):
    QUESTION = "question"
    CONFLICT = "conflict"
    BLOCKER = "blocker"
    SENSITIVE = "sensitive"


class EscalationStatus(StrEnum):
    OPEN = "open"
    ANSWERED = "answered"
    CLOSED = "closed"


@dataclass(frozen=True, slots=True)
class Chain:
    """Who answers at each level for one intern; missing people are skipped."""

    mentor_id: UUID | None
    lead_id: UUID | None
    hrbp_id: UUID | None

    def assignee(self, level: EscalationLevel) -> UUID | None:
        return {
            EscalationLevel.MENTOR: self.mentor_id,
            EscalationLevel.LEAD: self.lead_id,
            EscalationLevel.HRBP: self.hrbp_id,
        }[level]


@dataclass(frozen=True, slots=True)
class Assignment:
    level: EscalationLevel
    assignee_id: UUID


@dataclass(frozen=True, slots=True)
class EscalationView:
    id: UUID
    user_id: UUID
    user_name: str
    assignee_id: UUID
    assignee_name: str
    level: EscalationLevel
    kind: EscalationKind
    status: EscalationStatus
    question: str
    context: Mapping[str, Any]
    answer: str | None
    answered_by_name: str | None
    answered_at: datetime | None
    due_at: datetime
    faq_document_slug: str | None
    created_at: datetime

    def is_overdue(self, now: datetime) -> bool:
        return self.status is EscalationStatus.OPEN and self.due_at < now


class EscalationNotFoundError(NotFoundError):
    error_code = ErrorCode.ESCALATION_NOT_FOUND
    default_detail = "Question not found"


class EscalationClosedError(ConflictError):
    error_code = ErrorCode.ESCALATION_CLOSED
    default_detail = "This question is already answered or closed"


class NoAssigneeError(ConflictError):
    default_detail = "Nobody can take this question: the intern has no mentor, lead or HRBP"


def first_assignment(kind: EscalationKind, chain: Chain) -> Assignment:
    """Sensitive topics go straight to HRBP; everything else starts at the closest person."""
    levels = (EscalationLevel.HRBP,) if kind is EscalationKind.SENSITIVE else LEVEL_ORDER
    for level in levels:
        assignee = chain.assignee(level)
        if assignee is not None:
            return Assignment(level=level, assignee_id=assignee)
    raise NoAssigneeError()


def next_assignment(level: EscalationLevel, chain: Chain) -> Assignment | None:
    """The next person up the ladder, or None when HRBP already has it."""
    for upper in LEVEL_ORDER[LEVEL_ORDER.index(level) + 1 :]:
        assignee = chain.assignee(upper)
        if assignee is not None:
            return Assignment(level=upper, assignee_id=assignee)
    return None


def ensure_can_answer(*, actor_id: UUID, assignee_id: UUID, status: EscalationStatus) -> None:
    if status is not EscalationStatus.OPEN:
        raise EscalationClosedError()
    if actor_id != assignee_id:
        raise ForbiddenError("Only the person this question is assigned to can answer it")
