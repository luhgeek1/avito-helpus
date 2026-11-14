from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from app.core.clock import utcnow
from app.db.models import AuditLog, FeatureFlagRow
from app.db.uow import UnitOfWork
from app.domain.events import AnalyticsEvent, AuditAction
from app.domain.flags import FlagDecision, FlagNotFoundError, FlagState, evaluate_all
from app.domain.users import CurrentUser

UI_EVENTS = frozenset(
    {
        "plan.opened",
        "requests.opened",
        "chat.opened",
        "spotlight.opened",
        "source.opened",
        "mentor.opened",
    }
)


@dataclass(frozen=True, slots=True)
class MetricsSummary:
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


def to_flag_state(row: FeatureFlagRow) -> FlagState:
    return FlagState(
        key=row.key,
        enabled=row.enabled,
        rollout_percent=row.rollout_percent,
        variants=tuple(row.variants),
        description=row.description,
    )


class FlagService:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def decisions(self, unit: str) -> dict[str, FlagDecision]:
        flags = [to_flag_state(row) for row in await self._uow.ops.flags()]
        return dict(evaluate_all(flags, unit))

    async def is_on(self, key: str, unit: str) -> bool:
        decision = (await self.decisions(unit)).get(key)
        return decision is None or decision.enabled

    async def all(self) -> list[FlagState]:
        return [to_flag_state(row) for row in await self._uow.ops.flags()]

    async def update(
        self,
        actor: CurrentUser,
        key: str,
        *,
        enabled: bool,
        rollout_percent: int,
        variants: list[str],
    ) -> FlagState:
        row = await self._uow.ops.flag(key, for_update=True)
        if row is None:
            raise FlagNotFoundError()
        before = to_flag_state(row)
        row.enabled = enabled
        row.rollout_percent = rollout_percent
        row.variants = variants
        self._uow.ops.audit(
            AuditAction.FLAG_CHANGED,
            actor_id=actor.id,
            target_type="flag",
            target_id=key,
            details={
                "before": before.rollout_percent,
                "after": rollout_percent,
                "enabled": enabled,
            },
        )
        await self._uow.flush()
        return to_flag_state(row)


class AnalyticsService:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    def track_ui(self, actor: CurrentUser, name: str, properties: dict[str, Any]) -> bool:
        if name not in UI_EVENTS:
            return False
        self._uow.ops.track(
            AnalyticsEvent.UI_EVENT, user_id=actor.id, properties={"name": name, **properties}
        )
        return True

    async def summary(self, *, days: int = 30, now: datetime | None = None) -> MetricsSummary:
        since = (now or utcnow()) - timedelta(days=days)
        ops = self._uow.ops
        access_hours, approved = await ops.access_hours(since=since)
        searches = sum(
            (await ops.count_events(AnalyticsEvent.KNOWLEDGE_SEARCH, since=since)).values()
        )
        escalations, resolved, escalation_hours = await ops.escalation_stats(since=since)
        on_time, due = await ops.plan_on_time()
        feedback = await ops.feedback_counts(since=since)
        chats = await ops.count_events(AnalyticsEvent.CHAT_MESSAGE, since=since)
        fallbacks = sum(
            (await ops.count_events(AnalyticsEvent.CHAT_FALLBACK, since=since)).values()
        )
        return MetricsSummary(
            period_days=days,
            access_requests_approved=approved,
            access_hours_avg=round(access_hours, 2) if access_hours is not None else None,
            questions_total=searches,
            escalations_total=escalations,
            resolved_without_mentor_share=(
                round(1 - escalations / searches, 3) if searches else None
            ),
            escalations_resolved=resolved,
            escalation_hours_avg=round(escalation_hours, 2)
            if escalation_hours is not None
            else None,
            plan_on_time_share=round(on_time / due, 3) if due else None,
            feedback_up=feedback.get("up", 0),
            feedback_down=feedback.get("down", 0),
            chat_by_variant={variant or "none": count for variant, count in chats.items()},
            fallbacks=fallbacks,
        )

    async def audit(self, *, limit: int = 100) -> list[AuditLog]:
        return list(await self._uow.ops.audit_entries(limit=limit))
