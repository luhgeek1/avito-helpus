import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from app.core.errors import ConflictError, ErrorCode, ForbiddenError, NotFoundError
from app.domain.users import Role


class RequestKind(StrEnum):
    ACCESS = "access"
    ABSENCE = "absence"
    EQUIPMENT = "equipment"


class RequestStatus(StrEnum):
    SUBMITTING = "submitting"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RequestSource(StrEnum):
    USER = "user"
    AGENT = "agent"
    WORKER = "worker"
    WEBHOOK = "webhook"


TERMINAL_STATUSES = frozenset(
    {RequestStatus.APPROVED, RequestStatus.REJECTED, RequestStatus.FAILED, RequestStatus.CANCELLED}
)
OPEN_STATUSES = frozenset({RequestStatus.SUBMITTING, RequestStatus.SUBMITTED})

_ALLOWED: Mapping[RequestStatus, frozenset[RequestStatus]] = {
    RequestStatus.SUBMITTING: frozenset(
        {RequestStatus.SUBMITTED, RequestStatus.FAILED, RequestStatus.CANCELLED}
    ),
    RequestStatus.SUBMITTED: frozenset(
        {
            RequestStatus.APPROVED,
            RequestStatus.REJECTED,
            RequestStatus.CANCELLED,
            RequestStatus.FAILED,
        }
    ),
}

STATUS_TITLES: Mapping[RequestStatus, str] = {
    RequestStatus.SUBMITTING: "Отправляется",
    RequestStatus.SUBMITTED: "На согласовании",
    RequestStatus.APPROVED: "Одобрено",
    RequestStatus.REJECTED: "Отклонено",
    RequestStatus.FAILED: "Не удалось отправить",
    RequestStatus.CANCELLED: "Отменено",
}


class AccessLevel(StrEnum):
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"


LEVEL_TITLES: Mapping[AccessLevel, str] = {
    AccessLevel.READ: "чтение",
    AccessLevel.WRITE: "редактирование",
    AccessLevel.ADMIN: "администрирование",
}


class Sensitivity(StrEnum):
    STANDARD = "standard"
    RESTRICTED = "restricted"
    CONFIDENTIAL = "confidential"


class ApproverRole(StrEnum):
    TEAM_LEAD = "team_lead"
    DEVOPS = "devops"
    OWNER = "owner"


@dataclass(frozen=True, slots=True)
class AccessResource:
    id: UUID
    slug: str
    name: str
    system: str
    description: str
    team_id: UUID | None
    sensitivity: Sensitivity
    approver_role: ApproverRole
    default_level: AccessLevel
    aliases: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class RequestEventView:
    status: RequestStatus
    source: RequestSource
    note: str | None
    created_at: datetime


@dataclass(frozen=True, slots=True)
class RequestView:
    id: UUID
    user_id: UUID
    kind: RequestKind
    status: RequestStatus
    title: str
    external_id: str | None
    payload: Mapping[str, Any]
    approver: str | None
    decision_comment: str | None
    plan_item_id: UUID | None
    sla_due_at: datetime | None
    created_at: datetime
    updated_at: datetime
    history: list[RequestEventView] = field(default_factory=list)

    @property
    def status_title(self) -> str:
        return STATUS_TITLES[self.status]


class RequestNotFoundError(NotFoundError):
    error_code = ErrorCode.REQUEST_NOT_FOUND
    default_detail = "Request not found"


class ResourceNotFoundError(NotFoundError):
    """Also raised for resources the caller may not see: existence itself is not disclosed."""

    error_code = ErrorCode.RESOURCE_NOT_FOUND
    default_detail = "Resource not found or not available for your role"


class RequestTransitionError(ConflictError):
    error_code = ErrorCode.REQUEST_TRANSITION_INVALID
    default_detail = "The request can't change status that way"


class AccessLevelNotAllowedError(ForbiddenError):
    error_code = ErrorCode.ACCESS_LEVEL_NOT_ALLOWED
    default_detail = "This access level isn't available for your role; ask your mentor"


class RemindTooSoonError(ConflictError):
    error_code = ErrorCode.REMIND_TOO_SOON
    default_detail = "The approver was reminded recently; try again tomorrow"


def ensure_transition(current: RequestStatus, new: RequestStatus) -> None:
    if new not in _ALLOWED.get(current, frozenset()):
        raise RequestTransitionError(f"Request is {current.value}, can't become {new.value}")


def resource_visible(resource: AccessResource, *, role: Role, team_id: UUID | None) -> bool:
    """ABAC: confidential for HRBP/admin, restricted not for interns, team ones for the team."""
    if role is Role.ADMIN:
        return True
    if resource.sensitivity is Sensitivity.CONFIDENTIAL:
        return role is Role.HRBP
    if resource.sensitivity is Sensitivity.RESTRICTED and role is Role.INTERN:
        return False
    return resource.team_id is None or resource.team_id == team_id


def allowed_levels(role: Role) -> tuple[AccessLevel, ...]:
    if role is Role.INTERN:
        return (AccessLevel.READ, AccessLevel.WRITE)
    return tuple(AccessLevel)


def ensure_level_allowed(role: Role, level: AccessLevel) -> None:
    if level not in allowed_levels(role):
        raise AccessLevelNotAllowedError()


_WORD = re.compile(r"[a-zа-яё0-9]+")
_MIN_TOKEN = 3
_MIN_SCORE = 0.5
_TIE = 0.05
_QUERY_WEIGHT = 0.9


def _tokens(text: str) -> set[str]:
    return {token for token in _WORD.findall(text.lower()) if len(token) >= _MIN_TOKEN}


def _stem(token: str) -> str:
    # Crude Russian/English stem: enough to match "репозиторию" with "репозиторий".
    return token[:6] if len(token) > _MIN_TOKEN + 3 else token


def _score(resource: AccessResource, query_tokens: set[str]) -> float:
    """How well a resource matches: its name fully mentioned, or a short query fully covered."""
    names = [resource.slug, resource.name, resource.system, *resource.aliases]
    query_stems = {_stem(t) for t in query_tokens}
    best = 0.0
    for name in names:
        words = _tokens(name.replace("-", " ").replace("_", " ")) | _tokens(name)
        stems = {_stem(word) for word in words}
        if not stems:
            continue
        shared = len(stems & query_stems)
        best = max(best, shared / len(stems), _QUERY_WEIGHT * shared / len(query_stems))
    return best


def match_resources(
    query: str, resources: Sequence[AccessResource], *, limit: int = 5
) -> list[AccessResource]:
    """Rank visible resources by how many of their name tokens the query mentions."""
    query_tokens = _tokens(query.replace("-", " ").replace("_", " ")) | _tokens(query)
    if not query_tokens:
        return []
    scored = [(score, r) for r in resources if (score := _score(r, query_tokens)) >= _MIN_SCORE]
    if not scored:
        return []
    scored.sort(key=lambda pair: (-pair[0], pair[1].slug))
    # Only the best matches: "listings-api" must not drag in every resource named "listings".
    best = scored[0][0]
    return [resource for score, resource in scored[:limit] if score >= best - _TIE]


def access_justification(resource: AccessResource, *, team_name: str | None, stage: str) -> str:
    """Default justification the assistant proposes; the user can edit it on the card."""
    team = f" команды «{team_name}»" if team_name else ""
    return (
        f"Стажёр{team}. Доступ к ресурсу «{resource.name}» нужен для задач адаптации ({stage}); "
        "такой же доступ есть у участников команды."
    )
