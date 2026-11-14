from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from app.core.errors import ConflictError, ErrorCode, NotFoundError


class AssistantMode(StrEnum):
    ONLINE = "online"
    OFFLINE = "offline"


class ActionStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"


class Decision(StrEnum):
    APPROVE = "approve"
    REJECT = "reject"


@dataclass(frozen=True, slots=True)
class CardField:
    key: str
    label: str
    value: str
    editable: bool = False


@dataclass(frozen=True, slots=True)
class ActionCard:
    """What the user confirms: exactly what will be sent and to which service."""

    kind: str
    title: str
    service: str
    fields: list[CardField]
    warnings: list[str] = field(default_factory=list)
    note: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "title": self.title,
            "service": self.service,
            "fields": [
                {"key": f.key, "label": f.label, "value": f.value, "editable": f.editable}
                for f in self.fields
            ],
            "warnings": list(self.warnings),
            "note": self.note,
        }


@dataclass(frozen=True, slots=True)
class PendingActionView:
    id: UUID
    conversation_id: UUID
    tool_call_id: str
    tool_name: str
    status: ActionStatus
    card: Mapping[str, Any]
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class ConversationSummary:
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True, slots=True)
class ChatMessageView:
    id: UUID
    role: str
    parts: list[dict[str, Any]]
    feedback: str | None
    created_at: datetime


class ConversationNotFoundError(NotFoundError):
    error_code = ErrorCode.CONVERSATION_NOT_FOUND
    default_detail = "Conversation not found"


class ActionNotFoundError(NotFoundError):
    error_code = ErrorCode.ACTION_NOT_FOUND
    default_detail = "Action not found"


class ActionAlreadyDecidedError(ConflictError):
    error_code = ErrorCode.ACTION_ALREADY_DECIDED
    default_detail = "This action was already confirmed or declined"


class ActionExpiredError(ConflictError):
    error_code = ErrorCode.ACTION_EXPIRED
    default_detail = "This card has expired; ask Orbi again"
    # The card is marked expired in the same transaction; that change must survive the error.
    keep_changes = True


EDITABLE_ARGS: Mapping[str, frozenset[str]] = {
    "request_access": frozenset({"level", "justification"}),
    "request_absence": frozenset({"comment"}),
    "create_it_ticket": frozenset({"description"}),
    "ask_mentor": frozenset({"question"}),
    "post_team_message": frozenset({"text"}),
    "answer_question": frozenset({"answer", "publish_to_faq"}),
}


def apply_edits(
    tool_name: str, args: Mapping[str, Any], edits: Mapping[str, Any]
) -> dict[str, Any]:
    """Users may change only whitelisted fields of a card; everything else stays as proposed."""
    allowed = EDITABLE_ARGS.get(tool_name, frozenset())
    unknown = set(edits) - allowed
    if unknown:
        raise ConflictError(f"These fields can't be edited: {', '.join(sorted(unknown))}")
    return {**args, **edits}
