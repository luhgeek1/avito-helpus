import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from time import perf_counter
from uuid import UUID, uuid4
from zlib import crc32

from sqlalchemy import func, select

from app.core.clock import today, utcnow
from app.core.config import Settings
from app.db.database import Database
from app.db.uow import UnitOfWork
from app.domain.corp import CorpRequestError, CorpUnavailableError, EquipmentStatus
from app.domain.events import NotificationKind
from app.domain.flags import Flag
from app.domain.requests import RequestSource
from app.domain.users import CurrentUser, Role
from app.infra.metrics import WORKER_JOB_DURATION, WORKER_JOB_ITEMS, WORKER_JOBS, metric_job
from app.service.escalations import EscalationService
from app.service.mentor import MentorService
from app.service.notify import notify
from app.service.ops import FlagService
from app.service.ports import CorpServices, TextGenerator
from app.service.requests import RequestService, reconcile_ticket

logger = logging.getLogger(__name__)

RECONCILE_AFTER = timedelta(minutes=2)
DIGEST_INSTRUCTIONS = (
    "Ты помощник наставника стажёров. По данным о подопечных напиши короткую сводку к 1:1 "
    "на русском: "
    "по каждому стажёру 1–2 предложения — что сделано, что застряло, о чём спросить. Без воды."
)

Job = Callable[[], Awaitable[int]]


@dataclass(frozen=True, slots=True)
class ScheduledJob:
    name: str
    every: timedelta
    run: Job


async def _locked(uow: UnitOfWork, name: str) -> bool:
    """Transaction-scoped advisory lock: several workers never run the same job at once."""
    got = await uow.session.scalar(select(func.pg_try_advisory_xact_lock(crc32(name.encode()))))
    return bool(got)


class Nudges:
    """AI-cron: proactive reminders, escalation ladder, reconciliation and weekly digests."""

    def __init__(
        self,
        db: Database,
        corp: CorpServices,
        settings: Settings,
        *,
        generator: TextGenerator | None = None,
    ) -> None:
        self._db = db
        self._corp = corp
        self._settings = settings
        self._generator = generator

    def jobs(self) -> list[ScheduledJob]:
        tick = timedelta(seconds=self._settings.scheduler_interval_sec)
        return [
            ScheduledJob("escalations", tick, self.escalate),
            ScheduledJob("reconcile", tick, self.reconcile),
            ScheduledJob("overdue", tick * 10, self.overdue_steps),
            ScheduledJob("sla", tick * 10, self.requests_past_sla),
            ScheduledJob("equipment", tick * 20, self.equipment_ready),
            ScheduledJob("digest", timedelta(hours=6), self.mentor_digests),
        ]

    async def escalate(self) -> int:
        async with self._db.unit_of_work() as uow:
            if not await _locked(uow, "escalations"):
                return 0
            service = EscalationService(uow, sla_hours=self._settings.escalation_sla_hours)
            return await service.escalate_overdue(utcnow())

    async def reconcile(self) -> int:
        """Webhooks can get lost: ask the service about requests waiting for a decision."""
        async with self._db.unit_of_work() as uow:
            if not await _locked(uow, "reconcile"):
                return 0
            pending = await uow.requests.awaiting_decision(
                submitted_before=utcnow() - RECONCILE_AFTER
            )
            service = RequestService(
                uow, self._corp, access_sla_hours=self._settings.access_sla_hours
            )
            updated = 0
            for request in pending:
                try:
                    ticket = await reconcile_ticket(self._corp, request)
                except CorpUnavailableError:
                    return updated
                except CorpRequestError:
                    await service.mark_failed(
                        request,
                        (
                            "Заявка отсутствует или изменилась в корпоративном сервисе "
                            "после сброса демо. "
                            "Обратись в IT-поддержку."
                        ),
                    )
                    updated += 1
                    continue
                if ticket is None or request.external_id is None:
                    continue
                before = request.status
                await service.apply_decision(
                    external_id=request.external_id,
                    status=ticket.status,
                    comment=ticket.comment,
                    source=RequestSource.WORKER,
                )
                request.updated_at = utcnow()
                updated += int(request.status is not before)
            return updated

    async def overdue_steps(self) -> int:
        async with self._db.unit_of_work() as uow:
            if not await _locked(uow, "overdue"):
                return 0
            sent = 0
            on = today()
            for item, template in await uow.plan.overdue(on):
                if not await self._nudges_on(uow, item.user_id):
                    continue
                sent += await notify(
                    uow,
                    user_id=item.user_id,
                    kind=NotificationKind.NUDGE,
                    title="Шаг плана просрочен",
                    body=(
                        f"«{template.title}» — срок был {item.due_date:%d.%m}. "
                        "Орби поможет закрыть его."
                    ),
                    link=f"/plan?item={item.id}",
                    payload={"item_id": str(item.id), "action": template.action},
                    dedupe_key=f"overdue:{item.id}:{on.isoformat()}",
                )
            return sent

    async def requests_past_sla(self) -> int:
        async with self._db.unit_of_work() as uow:
            if not await _locked(uow, "sla"):
                return 0
            sent = 0
            for request in await uow.requests.past_sla(utcnow()):
                if not await self._nudges_on(uow, request.user_id):
                    continue
                sent += await notify(
                    uow,
                    user_id=request.user_id,
                    kind=NotificationKind.NUDGE,
                    title="Заявка дольше обычного на согласовании",
                    body=f"{request.title} ({request.external_id}). Можно напомнить согласующему.",
                    link=f"/requests/{request.id}",
                    payload={"request_id": str(request.id), "action": "remind"},
                    dedupe_key=f"sla:{request.id}:{today().isoformat()}",
                )
            return sent

    async def equipment_ready(self) -> int:
        async with self._db.unit_of_work() as uow:
            if not await _locked(uow, "equipment"):
                return 0
            sent = 0
            for intern in await uow.people.interns():
                try:
                    items = await self._corp.equipment(employee=intern.email)
                except CorpUnavailableError:
                    return sent
                for item in items:
                    if item.status is not EquipmentStatus.READY_FOR_PICKUP:
                        continue
                    sent += await notify(
                        uow,
                        user_id=intern.id,
                        kind=NotificationKind.NUDGE,
                        title=f"{item.model} готов к выдаче",
                        body=f"Забрать: {item.pickup_location}, {item.pickup_hours}.",
                        link="/plan",
                        payload={"equipment": item.kind},
                        dedupe_key=f"equipment-ready:{intern.id}:{item.kind}",
                    )
            return sent

    async def mentor_digests(self) -> int:
        async with self._db.unit_of_work() as uow:
            if not await _locked(uow, "digest"):
                return 0
            week = today().isocalendar()
            mentors = {i.mentor_id for i in await uow.people.interns() if i.mentor_id}
            sent = 0
            for mentor_id in mentors:
                mentor = await uow.people.get(mentor_id)
                if mentor is None:
                    continue
                text = await self.digest_text(uow, mentor.id, mentor.role)
                sent += await notify(
                    uow,
                    user_id=mentor.id,
                    kind=NotificationKind.DIGEST,
                    title="Сводка по подопечным к 1:1",
                    body=text,
                    link="/mentor",
                    dedupe_key=f"digest:{mentor.id}:{week.year}-{week.week}",
                )
            return sent

    async def digest_text(self, uow: UnitOfWork, mentor_id: UUID, role: Role) -> str:
        actor = CurrentUser(id=mentor_id, role=role, session_id=uuid4())
        summaries = await MentorService(uow).mentees(actor)
        lines = [
            f"{s.person.full_name}: день {s.internship_day or '—'}, {s.stage_title.lower()}, "
            f"готово {s.done}/{s.total}, просрочено {s.overdue}, "
            f"блокеров {len(s.blocked)}, ждут подтверждения {len(s.awaiting_review)}, "
            f"открытых вопросов {s.open_questions}."
            for s in summaries
        ]
        facts = "\n".join(lines) or "Подопечных пока нет."
        if self._generator is not None and lines:
            generated = await self._generator.generate(DIGEST_INSTRUCTIONS, facts)
            if generated:
                return generated
        return facts

    async def _nudges_on(self, uow: UnitOfWork, user_id: UUID) -> bool:
        user = await uow.people.get(user_id)
        team = await uow.people.team(user.team_id) if user else None
        return await FlagService(uow).is_on(Flag.PROACTIVE_NUDGES, team.slug if team else "none")


async def run_due(jobs: list[ScheduledJob], next_runs: dict[str, datetime], now: datetime) -> None:
    for job in jobs:
        if now < next_runs.get(job.name, now):
            continue
        next_runs[job.name] = now + job.every
        label = metric_job(job.name)
        started = perf_counter()
        try:
            done = await job.run()
        except Exception:  # one failing job must not stop the others
            WORKER_JOBS.labels(task=label, outcome="error").inc()
            logger.exception("scheduled job %s failed", job.name)
            continue
        finally:
            WORKER_JOB_DURATION.labels(task=label).observe(perf_counter() - started)
        WORKER_JOBS.labels(task=label, outcome="ok").inc()
        WORKER_JOB_ITEMS.labels(task=label).inc(done)
        if done:
            logger.info("scheduled job %s: %s", job.name, done)
