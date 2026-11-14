from enum import StrEnum


class Topic(StrEnum):
    """Outbox topics: side effects that must happen only after the transaction commits."""

    REQUEST_SUBMIT = "request.submit"
    REALTIME_PUBLISH = "realtime.publish"
    KB_EMBED = "kb.embed"
    MESSENGER_POST = "messenger.post"


class OutboxStatus(StrEnum):
    PENDING = "pending"
    DONE = "done"
    DEAD = "dead"


class NotificationKind(StrEnum):
    REQUEST_UPDATED = "request_updated"
    PLAN_UPDATED = "plan_updated"
    ESCALATION_ASSIGNED = "escalation_assigned"
    ESCALATION_ANSWERED = "escalation_answered"
    REVIEW_REQUESTED = "review_requested"
    NUDGE = "nudge"
    DIGEST = "digest"


class RealtimeEvent(StrEnum):
    """Event names on the per-user SSE stream (`GET /api/v1/events`)."""

    NOTIFICATION = "notification.created"
    REQUEST = "request.updated"
    PLAN = "plan.updated"
    ESCALATION = "escalation.updated"


class AnalyticsEvent(StrEnum):
    CHAT_MESSAGE = "chat.message"
    CHAT_FALLBACK = "chat.fallback"
    TOOL_CALLED = "tool.called"
    ACTION_PROPOSED = "action.proposed"
    ACTION_DECIDED = "action.decided"
    REQUEST_CREATED = "request.created"
    REQUEST_RESOLVED = "request.resolved"
    PLAN_ITEM_DONE = "plan.item_done"
    ESCALATION_CREATED = "escalation.created"
    ESCALATION_ANSWERED = "escalation.answered"
    ANSWER_FEEDBACK = "answer.feedback"
    KNOWLEDGE_SEARCH = "knowledge.search"
    UI_EVENT = "ui.event"


class AuditAction(StrEnum):
    ACTION_APPROVED = "action.approved"
    ACTION_REJECTED = "action.rejected"
    REQUEST_CREATED = "request.created"
    REQUEST_CANCELLED = "request.cancelled"
    REQUEST_STATUS = "request.status"
    ESCALATION_ANSWERED = "escalation.answered"
    FAQ_PUBLISHED = "faq.published"
    PLAN_REVIEWED = "plan.reviewed"
    FLAG_CHANGED = "flag.changed"
    DEMO_RESET = "demo.reset"
    SENSITIVE_ROUTED = "sensitive.routed"
