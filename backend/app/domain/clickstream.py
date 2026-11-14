"""Synthetic analytics wire contract. Never export arbitrary user-supplied properties."""

import hashlib
import hmac
from collections.abc import Mapping
from datetime import datetime
from typing import Any, TypedDict
from uuid import UUID

from app.domain.events import AnalyticsEvent

type Property = str | int | bool
MAX_COUNT = 10000


class AnalyticsEnvelope(TypedDict):
    schema_version: int
    event_id: str
    name: str
    occurred_at: str
    actor: str | None
    properties: dict[str, Property]
    is_synthetic: bool


# Both keys AND values are allowlisted: a recognized key must never carry free text.
_ENUMS: dict[str, frozenset[str]] = {
    "mode": frozenset({"online", "offline", "hybrid", "fts"}),
    "rating": frozenset({"up", "down"}),
    "decision": frozenset({"approve", "reject"}),
    "kind": frozenset(
        {"access", "absence", "equipment", "question", "conflict", "blocker", "sensitive"}
    ),
    "source": frozenset({"user", "agent", "worker", "webhook"}),
    "status": frozenset({"approved", "rejected", "failed", "cancelled"}),
    "level": frozenset({"mentor", "lead", "hrbp"}),
    "tool": frozenset(
        {
            "get_my_plan",
            "update_plan_step",
            "search_knowledge",
            "find_access_resources",
            "request_access",
            "request_absence",
            "my_requests",
            "check_absence",
            "equipment_status",
            "create_it_ticket",
            "ask_mentor",
            "post_team_message",
            "who_is_who",
            "list_mentees",
            "open_questions",
            "answer_question",
        }
    ),
    "name": frozenset(
        {
            "plan.opened",
            "requests.opened",
            "chat.opened",
            "spotlight.opened",
            "source.opened",
            "mentor.opened",
        }
    ),
}
_FIELDS: dict[str, frozenset[str]] = {
    AnalyticsEvent.CHAT_MESSAGE: frozenset({"mode"}),
    AnalyticsEvent.TOOL_CALLED: frozenset({"tool"}),
    AnalyticsEvent.ACTION_PROPOSED: frozenset({"tool"}),
    AnalyticsEvent.ACTION_DECIDED: frozenset({"tool", "decision"}),
    AnalyticsEvent.REQUEST_CREATED: frozenset({"kind", "source"}),
    AnalyticsEvent.REQUEST_RESOLVED: frozenset({"kind", "status"}),
    AnalyticsEvent.ESCALATION_CREATED: frozenset({"kind", "level"}),
    AnalyticsEvent.ESCALATION_ANSWERED: frozenset({"level", "faq"}),
    AnalyticsEvent.ANSWER_FEEDBACK: frozenset({"rating"}),
    AnalyticsEvent.KNOWLEDGE_SEARCH: frozenset({"hits", "conflicts", "mode"}),
    AnalyticsEvent.UI_EVENT: frozenset({"name"}),
}


def safe_properties(name: str, properties: Mapping[str, Any]) -> dict[str, Property]:
    result: dict[str, Property] = {}
    for key in _FIELDS.get(name, frozenset()):
        value = properties.get(key)
        if (
            (key in _ENUMS and isinstance(value, str) and value in _ENUMS[key])
            or (key in {"hits", "conflicts"} and type(value) is int and 0 <= value <= MAX_COUNT)
            or (key == "faq" and type(value) is bool)
        ):
            result[key] = value
    return result


def envelope(
    *,
    event_id: UUID,
    name: str,
    occurred_at: datetime,
    user_id: UUID | None,
    properties: Mapping[str, Any],
    secret: bytes,
) -> AnalyticsEnvelope:
    return {
        "schema_version": 1,
        "event_id": str(event_id),
        "name": name if name in AnalyticsEvent else "unknown",
        "occurred_at": occurred_at.isoformat(),
        "actor": hmac.new(
            secret, f"orbi.analytics.v1:{user_id}".encode(), hashlib.sha256
        ).hexdigest()
        if user_id is not None
        else None,
        "properties": safe_properties(name, properties),
        "is_synthetic": True,
    }
