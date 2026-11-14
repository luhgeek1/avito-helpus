from collections.abc import Sequence
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from app.core.clock import today, utcnow
from app.core.errors import ForbiddenError
from app.db.models import Escalation, KbDocument, User
from app.db.uow import UnitOfWork
from app.domain.escalations import (
    LEVEL_TITLES,
    Chain,
    EscalationKind,
    EscalationNotFoundError,
    EscalationStatus,
    EscalationView,
    ensure_can_answer,
    first_assignment,
    next_assignment,
)
from app.domain.events import AnalyticsEvent, AuditAction, NotificationKind, RealtimeEvent
from app.domain.knowledge import ConflictNotFoundError, ConflictStatus, DocKind, DocScope
from app.domain.users import CurrentUser, Permission, Role, UserNotFoundError
from app.service.knowledge import KnowledgeService
from app.service.mappers import to_escalation
from app.service.notify import notify, push

_FAQ_TITLE_MAX = 120
KIND_TITLES = {
    EscalationKind.QUESTION: "Вопрос",
    EscalationKind.CONFLICT: "Противоречие в инструкциях",
    EscalationKind.BLOCKER: "Блокер",
    EscalationKind.SENSITIVE: "Деликатная тема",
}


class EscalationService:
    def __init__(self, uow: UnitOfWork, *, sla_hours: float) -> None:
        self._uow = uow
        self._sla = timedelta(hours=sla_hours)

    async def create(
        self,
        actor: CurrentUser,
        *,
        question: str,
        kind: EscalationKind,
        context: dict[str, Any] | None = None,
        conversation_id: UUID | None = None,
    ) -> EscalationView:
        asker = await self._user(actor.id)
        assignment = first_assignment(kind, _chain(asker))
        escalation = Escalation(
            user_id=asker.id,
            assignee_id=assignment.assignee_id,
            level=assignment.level,
            kind=kind,
            question=question.strip(),
            context=context or {},
            due_at=utcnow() + self._sla,
            conversation_id=conversation_id,
        )
        self._uow.escalations.add(escalation)
        await self._uow.flush()
        await notify(
            self._uow,
            user_id=assignment.assignee_id,
            kind=NotificationKind.ESCALATION_ASSIGNED,
            title=f"{KIND_TITLES[kind]} от {asker.full_name}",
            body=escalation.question,
            link=f"/mentor/questions/{escalation.id}",
            payload={"escalation_id": str(escalation.id)},
        )
        self._uow.ops.track(
            AnalyticsEvent.ESCALATION_CREATED,
            user_id=asker.id,
            properties={"kind": kind.value, "level": assignment.level.value},
        )
        if kind is EscalationKind.SENSITIVE:
            self._uow.ops.audit(
                AuditAction.SENSITIVE_ROUTED,
                actor_id=asker.id,
                target_type="escalation",
                target_id=str(escalation.id),
            )
        return await self._view(escalation)

    async def report_conflict(
        self, actor: CurrentUser, conflict_id: UUID, *, note: str | None = None
    ) -> EscalationView:
        conflict = await self._uow.knowledge.conflict(conflict_id)
        if conflict is None:
            raise ConflictNotFoundError()
        rows = await self._uow.knowledge.chunk_rows(
            [conflict.company_chunk_id, conflict.team_chunk_id]
        )
        company, team = rows.get(conflict.company_chunk_id), rows.get(conflict.team_chunk_id)
        if company is None or team is None or team.document.team_id != actor.team_id:
            raise ConflictNotFoundError()
        conflict.status = ConflictStatus.REPORTED
        question = note or (
            f"Общая инструкция и инструкция команды расходятся ({conflict.summary}). Как правильно?"
        )
        return await self.create(
            actor,
            question=question,
            kind=EscalationKind.CONFLICT,
            context={
                "conflict_id": str(conflict.id),
                "company": {
                    "title": company.document.title,
                    "section": company.chunk.heading,
                    "text": company.chunk.content,
                },
                "team": {
                    "title": team.document.title,
                    "section": team.chunk.heading,
                    "text": team.chunk.content,
                },
            },
        )

    async def mine(self, actor: CurrentUser) -> list[EscalationView]:
        rows = await self._uow.escalations.asked_by(actor.id)
        return await self._views(rows)

    async def assigned(
        self, actor: CurrentUser, *, status: EscalationStatus | None = EscalationStatus.OPEN
    ) -> list[EscalationView]:
        rows = await self._uow.escalations.assigned_to(actor.id, status=status)
        return await self._views(rows)

    async def get(self, actor: CurrentUser, escalation_id: UUID) -> EscalationView:
        escalation = await self._uow.escalations.get(escalation_id)
        if escalation is None or not _can_see(actor, escalation):
            raise EscalationNotFoundError()
        return await self._view(escalation)

    async def answer(
        self,
        actor: CurrentUser,
        escalation_id: UUID,
        *,
        answer: str,
        publish_to_faq: bool,
        knowledge: KnowledgeService,
    ) -> EscalationView:
        escalation = await self._uow.escalations.get(escalation_id, for_update=True)
        if escalation is None or not _can_see(actor, escalation):
            raise EscalationNotFoundError()
        if not actor.can(Permission.ESCALATIONS_ANSWER):
            raise ForbiddenError()
        ensure_can_answer(
            actor_id=actor.id, assignee_id=escalation.assignee_id, status=escalation.status
        )
        responder = await self._user(actor.id)
        escalation.answer = answer.strip()
        escalation.answered_by_id = actor.id
        escalation.answered_at = utcnow()
        escalation.status = EscalationStatus.ANSWERED
        faq_slug: str | None = None
        if (
            publish_to_faq
            and actor.can(Permission.FAQ_PUBLISH)
            and escalation.kind is not EscalationKind.SENSITIVE
        ):
            faq_slug = await self._publish_faq(escalation, responder, knowledge)
        await self._uow.flush()
        await notify(
            self._uow,
            user_id=escalation.user_id,
            kind=NotificationKind.ESCALATION_ANSWERED,
            title=f"{responder.full_name} ответил(а) на твой вопрос",
            body=escalation.answer,
            link=f"/questions/{escalation.id}",
            payload={"escalation_id": str(escalation.id), "faq": faq_slug},
        )
        self._uow.ops.track(
            AnalyticsEvent.ESCALATION_ANSWERED,
            user_id=actor.id,
            properties={"level": escalation.level.value, "faq": faq_slug is not None},
        )
        self._uow.ops.audit(
            AuditAction.ESCALATION_ANSWERED,
            actor_id=actor.id,
            target_type="escalation",
            target_id=str(escalation.id),
            details={"faq": faq_slug},
        )
        return await self._view(escalation, faq_slug)

    async def close(self, actor: CurrentUser, escalation_id: UUID) -> EscalationView:
        escalation = await self._uow.escalations.get(escalation_id, for_update=True)
        if escalation is None or escalation.user_id != actor.id:
            raise EscalationNotFoundError()
        escalation.status = EscalationStatus.CLOSED
        push(
            self._uow,
            escalation.assignee_id,
            RealtimeEvent.ESCALATION,
            {"escalation_id": str(escalation.id), "status": "closed"},
        )
        await self._uow.flush()
        return await self._view(escalation)

    async def escalate_overdue(self, now: datetime) -> int:
        """AI-cron: unanswered past the deadline -> next level, and everyone involved is told."""
        moved = 0
        for escalation in await self._uow.escalations.overdue(now):
            asker = await self._uow.people.get(escalation.user_id)
            if asker is None:
                continue
            upper = next_assignment(escalation.level, _chain(asker))
            if upper is None:
                continue
            escalation.level = upper.level
            escalation.assignee_id = upper.assignee_id
            escalation.due_at = now + self._sla
            await notify(
                self._uow,
                user_id=upper.assignee_id,
                kind=NotificationKind.ESCALATION_ASSIGNED,
                title=f"Вопрос {asker.full_name} без ответа — передан тебе",
                body=escalation.question,
                link=f"/mentor/questions/{escalation.id}",
                payload={"escalation_id": str(escalation.id)},
            )
            await notify(
                self._uow,
                user_id=asker.id,
                kind=NotificationKind.ESCALATION_ASSIGNED,
                title=f"Вопрос передан: {LEVEL_TITLES[upper.level]}",
                body="Ответа не было в срок, Орби поднял вопрос выше.",
                link=f"/questions/{escalation.id}",
                payload={"escalation_id": str(escalation.id)},
            )
            moved += 1
        await self._uow.flush()
        return moved

    async def _publish_faq(
        self, escalation: Escalation, responder: User, knowledge: KnowledgeService
    ) -> str:
        asker = await self._user(escalation.user_id)
        title = (
            escalation.question
            if len(escalation.question) <= _FAQ_TITLE_MAX
            else (escalation.question[: _FAQ_TITLE_MAX - 1] + "…")
        )
        document = await knowledge.ingest(
            slug=f"faq-{escalation.id.hex[:12]}",
            title=f"FAQ: {title}",
            kind=DocKind.FAQ,
            scope=DocScope.TEAM,
            team_id=asker.team_id,
            roles=[],
            owner=responder.full_name,
            source_label="FAQ команды: ответ наставника",
            source_url=None,
            updated_at=today(),
            body=f"## Вопрос\n\n{escalation.question}\n\n## Ответ\n\n{escalation.answer}\n",
        )
        escalation.faq_document_id = document.id
        self._uow.ops.audit(
            AuditAction.FAQ_PUBLISHED,
            actor_id=responder.id,
            target_type="kb_document",
            target_id=document.slug,
        )
        return document.slug

    async def _views(self, rows: Sequence[Escalation]) -> list[EscalationView]:
        people = await self._uow.people.get_many(
            [r.user_id for r in rows]
            + [r.assignee_id for r in rows]
            + [r.answered_by_id for r in rows]
        )
        return [to_escalation(row, people) for row in rows]

    async def _view(self, escalation: Escalation, faq_slug: str | None = None) -> EscalationView:
        people = await self._uow.people.get_many(
            [escalation.user_id, escalation.assignee_id, escalation.answered_by_id]
        )
        if faq_slug is None and escalation.faq_document_id is not None:
            document = await self._uow.session.get(KbDocument, escalation.faq_document_id)
            faq_slug = document.slug if document else None
        return to_escalation(escalation, people, faq_slug)

    async def _user(self, user_id: UUID) -> User:
        user = await self._uow.people.get(user_id)
        if user is None:
            raise UserNotFoundError()
        return user


def _chain(user: User) -> Chain:
    return Chain(mentor_id=user.mentor_id, lead_id=user.lead_id, hrbp_id=user.hrbp_id)


def _can_see(actor: CurrentUser, escalation: Escalation) -> bool:
    return actor.role is Role.ADMIN or actor.id in {escalation.user_id, escalation.assignee_id}
