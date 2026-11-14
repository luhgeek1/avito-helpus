from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from uuid import UUID

from app.core.errors import ErrorCode, ForbiddenError, NotFoundError


class Role(StrEnum):
    INTERN = "intern"
    MENTOR = "mentor"
    LEAD = "lead"
    HRBP = "hrbp"
    ADMIN = "admin"


class Permission(StrEnum):
    ASSISTANT_USE = "assistant:use"
    PLAN_OWN = "plan:own"
    REQUESTS_OWN = "requests:own"
    KNOWLEDGE_READ = "knowledge:read"
    ESCALATIONS_CREATE = "escalations:create"
    MENTEES_READ = "mentees:read"
    PLAN_REVIEW = "plan:review"
    ESCALATIONS_ANSWER = "escalations:answer"
    FAQ_PUBLISH = "faq:publish"
    ANALYTICS_READ = "analytics:read"
    AUDIT_READ = "audit:read"
    FLAGS_MANAGE = "flags:manage"
    DEMO_RESET = "demo:reset"


_EMPLOYEE = frozenset(
    {
        Permission.ASSISTANT_USE,
        Permission.PLAN_OWN,
        Permission.REQUESTS_OWN,
        Permission.KNOWLEDGE_READ,
        Permission.ESCALATIONS_CREATE,
    }
)
_MENTOR = _EMPLOYEE | {
    Permission.MENTEES_READ,
    Permission.PLAN_REVIEW,
    Permission.ESCALATIONS_ANSWER,
    Permission.FAQ_PUBLISH,
}

# Roles are code, not data: a role is a named set of permissions, checked without a DB query.
# Data-dependent rules (whose mentee, which team) live in the functions below.
ROLE_PERMISSIONS: Mapping[Role, frozenset[Permission]] = {
    Role.INTERN: _EMPLOYEE,
    Role.MENTOR: _MENTOR,
    Role.LEAD: _MENTOR | {Permission.ANALYTICS_READ},
    Role.HRBP: _EMPLOYEE
    | {
        Permission.MENTEES_READ,
        Permission.ESCALATIONS_ANSWER,
        Permission.ANALYTICS_READ,
        Permission.AUDIT_READ,
    },
    Role.ADMIN: frozenset(Permission),
}

ROLE_TITLES: Mapping[Role, str] = {
    Role.INTERN: "Стажёр",
    Role.MENTOR: "Наставник",
    Role.LEAD: "Руководитель",
    Role.HRBP: "HRBP",
    Role.ADMIN: "Администратор",
}


@dataclass(frozen=True, slots=True)
class CurrentUser:
    """Who is calling. The only user object the API layer ever sees."""

    id: UUID
    role: Role
    session_id: UUID
    team_id: UUID | None = None

    def can(self, permission: Permission) -> bool:
        return permission in ROLE_PERMISSIONS[self.role]

    @property
    def permissions(self) -> frozenset[Permission]:
        return ROLE_PERMISSIONS[self.role]


@dataclass(frozen=True, slots=True)
class PersonRef:
    id: UUID
    full_name: str
    title: str
    email: str


@dataclass(frozen=True, slots=True)
class TeamRef:
    id: UUID
    slug: str
    name: str
    channel: str


@dataclass(frozen=True, slots=True)
class Person:
    id: UUID
    email: str
    full_name: str
    title: str
    role: Role
    track: str
    start_date: date | None
    team: TeamRef | None
    mentor: PersonRef | None
    lead: PersonRef | None
    hrbp: PersonRef | None

    def internship_day(self, today: date) -> int | None:
        """Calendar day of the internship, starting at 1; None before the start or for staff."""
        if self.start_date is None or today < self.start_date:
            return None
        return (today - self.start_date).days + 1


@dataclass(frozen=True, slots=True)
class MemberLinks:
    """What ABAC needs to know about another employee."""

    id: UUID
    team_id: UUID | None
    mentor_id: UUID | None
    lead_id: UUID | None
    hrbp_id: UUID | None


class UserNotFoundError(NotFoundError):
    error_code = ErrorCode.USER_NOT_FOUND
    default_detail = "User not found"


class MenteeNotFoundError(NotFoundError):
    error_code = ErrorCode.MENTEE_NOT_FOUND
    default_detail = "Mentee not found"


class AccountBannedError(ForbiddenError):
    error_code = ErrorCode.ACCOUNT_BANNED
    default_detail = "Your account is banned"


def normalize_email(email: str) -> str:
    return email.strip().lower()


def can_view_member(actor: CurrentUser, member: MemberLinks) -> bool:
    """ABAC for people data: yourself, your mentees, your team (lead), your interns (HRBP)."""
    if actor.id == member.id or actor.role is Role.ADMIN:
        return True
    if actor.role is Role.HRBP:
        return member.hrbp_id == actor.id
    if actor.role is Role.LEAD and member.lead_id == actor.id:
        return True
    return actor.can(Permission.MENTEES_READ) and member.mentor_id == actor.id


def can_review_member(actor: CurrentUser, member: MemberLinks) -> bool:
    """Who confirms mentor-confirmed plan items: the mentor, or the lead when there is none."""
    if not actor.can(Permission.PLAN_REVIEW) or actor.id == member.id:
        return False
    if actor.role is Role.ADMIN or member.mentor_id == actor.id:
        return True
    return member.lead_id == actor.id and (actor.role is Role.LEAD or member.mentor_id is None)


def ensure_can_view_member(actor: CurrentUser, member: MemberLinks) -> None:
    # 404, not 403: whether someone is another mentor's mentee is not our caller's business.
    if not can_view_member(actor, member):
        raise MenteeNotFoundError()
