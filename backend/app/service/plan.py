from collections.abc import Sequence
from datetime import date
from uuid import UUID

from app.core.clock import today, utcnow
from app.core.errors import ForbiddenError
from app.db.models import PlanItem, PlanTemplateItem, User
from app.db.uow import UnitOfWork
from app.domain.events import AnalyticsEvent, AuditAction, NotificationKind, RealtimeEvent
from app.domain.plan import (
    Audience,
    ItemStatus,
    PlanItemNotFoundError,
    PlanItemView,
    PlanOverview,
    QuizResult,
    Transition,
    WaitingReason,
    build_overview,
    check_quiz,
    due_date,
    next_status,
)
from app.domain.users import CurrentUser, UserNotFoundError, can_review_member
from app.service.mappers import to_links, to_plan_item
from app.service.notify import notify, push


class PlanService:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def instantiate(self, user: User, *, start: date) -> int:
        """Create the intern's plan from the checklist template (idempotent per template row)."""
        existing = {item.template_item_id for item, _ in await self._uow.plan.items(user.id)}
        created = 0
        for template in await self._uow.plan.templates(user.track):
            if template.id in existing:
                continue
            self._uow.plan.add_item(
                PlanItem(
                    user_id=user.id,
                    template_item_id=template.id,
                    due_date=due_date(start, template.stage),
                )
            )
            created += 1
        await self._uow.flush()
        return created

    async def overview(self, user_id: UUID, *, on: date | None = None) -> PlanOverview:
        user = await self._uow.people.get(user_id)
        if user is None:
            raise UserNotFoundError()
        rows = await self._uow.plan.items(user_id)
        items = [to_plan_item(item, template) for item, template in rows]
        start = user.start_date or (on or today())
        return build_overview(user_id=user_id, start=start, today=on or today(), items=items)

    async def item(self, actor: CurrentUser, item_id: UUID) -> PlanItemView:
        row = await self._uow.plan.get(item_id)
        if row is None or row[0].user_id != actor.id:
            raise PlanItemNotFoundError()
        return to_plan_item(*row)

    async def transition(
        self,
        actor: CurrentUser,
        item_id: UUID,
        transition: Transition,
        *,
        comment: str | None = None,
    ) -> PlanItemView:
        item, template = await self._load_for(actor, item_id)
        reviewer = actor.id != item.user_id
        new_status = next_status(
            status=item.status,
            transition=transition,
            confirmation=template.confirmation,
            audience=template.audience,
            waiting_reason=item.waiting_reason,
            by_reviewer=reviewer,
        )
        self._apply(item, template, new_status, transition, actor=actor, comment=comment)
        await self._uow.flush()
        await self._after_change(item, template, transition, actor=actor, comment=comment)
        return to_plan_item(item, template)

    async def submit_quiz(
        self, actor: CurrentUser, item_id: UUID, answers: Sequence[int]
    ) -> tuple[QuizResult, PlanItemView]:
        item, template = await self._load_for(actor, item_id)
        view = to_plan_item(item, template)
        if item.user_id != actor.id or not view.quiz or item.status is ItemStatus.DONE:
            raise ForbiddenError("This step has no quiz for you")
        result = check_quiz(view.quiz, answers)
        if result.passed:
            item.status = ItemStatus.DONE
            item.completed_at = utcnow()
            item.confirmed_by_id = actor.id
            await self._uow.flush()
            await self._after_change(item, template, Transition.COMPLETE, actor=actor, comment=None)
        return result, to_plan_item(item, template)

    async def link_request(self, item_id: UUID, request_id: UUID) -> None:
        row = await self._uow.plan.get(item_id, for_update=True)
        if row is None:
            return
        item = row[0]
        if item.status is ItemStatus.DONE:
            return
        item.status = ItemStatus.WAITING
        item.waiting_reason = WaitingReason.REQUEST
        item.request_id = request_id
        item.started_at = item.started_at or utcnow()
        push(
            self._uow,
            item.user_id,
            RealtimeEvent.PLAN,
            {"item_id": str(item.id), "status": "waiting"},
        )
        await self._uow.flush()

    async def complete_by_system(self, item_id: UUID, *, note: str) -> None:
        """A step whose outcome the system can see for itself (e.g. access already granted)."""
        row = await self._uow.plan.get(item_id, for_update=True)
        if row is None or row[0].status is ItemStatus.DONE:
            return
        item, template = row
        item.status = ItemStatus.DONE
        item.completed_at = utcnow()
        item.waiting_reason = None
        item.review_comment = note
        self._uow.ops.track(
            AnalyticsEvent.PLAN_ITEM_DONE, user_id=item.user_id, properties={"slug": template.slug}
        )
        push(
            self._uow, item.user_id, RealtimeEvent.PLAN, {"item_id": str(item.id), "status": "done"}
        )
        await self._uow.flush()

    async def request_resolved(self, item_id: UUID, *, approved: bool) -> PlanItemView | None:
        """A linked request finished: approval closes the step, anything else reopens it."""
        row = await self._uow.plan.get(item_id, for_update=True)
        if row is None:
            return None
        item, template = row
        if (
            item.status is not ItemStatus.WAITING
            or item.waiting_reason is not WaitingReason.REQUEST
        ):
            return to_plan_item(item, template)
        item.waiting_reason = None
        if approved:
            item.status = ItemStatus.DONE
            item.completed_at = utcnow()
            self._uow.ops.track(
                AnalyticsEvent.PLAN_ITEM_DONE,
                user_id=item.user_id,
                properties={"slug": template.slug},
            )
        else:
            item.status = ItemStatus.IN_PROGRESS
        push(
            self._uow,
            item.user_id,
            RealtimeEvent.PLAN,
            {"item_id": str(item.id), "status": item.status.value},
        )
        await self._uow.flush()
        return to_plan_item(item, template)

    async def _load_for(
        self, actor: CurrentUser, item_id: UUID
    ) -> tuple[PlanItem, PlanTemplateItem]:
        row = await self._uow.plan.get(item_id, for_update=True)
        if row is None:
            raise PlanItemNotFoundError()
        item, template = row
        if item.user_id == actor.id:
            return item, template
        owner = await self._uow.people.get(item.user_id)
        # 404 for strangers: the plan of someone else's intern is not theirs to discover.
        if owner is None or not can_review_member(actor, to_links(owner)):
            raise PlanItemNotFoundError()
        return item, template

    @staticmethod
    def _apply(
        item: PlanItem,
        template: PlanTemplateItem,
        new_status: ItemStatus,
        transition: Transition,
        *,
        actor: CurrentUser,
        comment: str | None,
    ) -> None:
        now = utcnow()
        item.status = new_status
        if new_status is ItemStatus.IN_PROGRESS:
            item.started_at = item.started_at or now
            item.waiting_reason = None
            item.blocked_reason = None
        if transition is Transition.SUBMIT_REVIEW:
            item.waiting_reason = WaitingReason.MENTOR_REVIEW
            item.started_at = item.started_at or now
        if transition is Transition.BLOCK:
            item.blocked_reason = comment or "Заблокировано"
        if transition is Transition.RETURN:
            item.review_comment = comment
        if new_status is ItemStatus.DONE:
            item.completed_at = now
            item.waiting_reason = None
            item.confirmed_by_id = actor.id
            if comment and transition is Transition.APPROVE:
                item.review_comment = comment
        del template  # template rules are already enforced by next_status

    async def _after_change(
        self,
        item: PlanItem,
        template: PlanTemplateItem,
        transition: Transition,
        *,
        actor: CurrentUser,
        comment: str | None,
    ) -> None:
        owner = await self._uow.people.get(item.user_id)
        if owner is None:
            return
        reviewer_id = owner.mentor_id or owner.lead_id
        if item.status is ItemStatus.DONE:
            self._uow.ops.track(
                AnalyticsEvent.PLAN_ITEM_DONE, user_id=owner.id, properties={"slug": template.slug}
            )
        if transition is Transition.SUBMIT_REVIEW and reviewer_id:
            await notify(
                self._uow,
                user_id=reviewer_id,
                kind=NotificationKind.REVIEW_REQUESTED,
                title=f"{owner.full_name} просит подтвердить шаг",
                body=f"«{template.title}»" + (f": {comment}" if comment else ""),
                link=f"/mentor/mentees/{owner.id}",
                payload={"item_id": str(item.id), "user_id": str(owner.id)},
            )
        if transition is Transition.BLOCK and reviewer_id:
            await notify(
                self._uow,
                user_id=reviewer_id,
                kind=NotificationKind.PLAN_UPDATED,
                title=f"{owner.full_name}: шаг заблокирован",
                body=f"«{template.title}» — {item.blocked_reason}",
                link=f"/mentor/mentees/{owner.id}",
                payload={"item_id": str(item.id), "user_id": str(owner.id)},
            )
        if transition in {Transition.APPROVE, Transition.RETURN} or (
            template.audience is Audience.MENTOR and actor.id != owner.id
        ):
            approved = item.status is ItemStatus.DONE
            await notify(
                self._uow,
                user_id=owner.id,
                kind=NotificationKind.PLAN_UPDATED,
                title=("Шаг подтверждён" if approved else "Шаг вернули на доработку"),
                body=f"«{template.title}»" + (f": {comment}" if comment else ""),
                link="/plan",
                payload={"item_id": str(item.id)},
            )
            self._uow.ops.audit(
                AuditAction.PLAN_REVIEWED,
                actor_id=actor.id,
                target_type="plan_item",
                target_id=str(item.id),
                details={"transition": transition.value, "comment": comment},
            )
        push(
            self._uow,
            owner.id,
            RealtimeEvent.PLAN,
            {"item_id": str(item.id), "status": item.status.value},
        )
