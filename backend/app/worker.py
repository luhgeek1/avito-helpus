import asyncio
import logging
import signal
from contextlib import suppress
from datetime import UTC, datetime, timedelta

from redis.asyncio import Redis

from app.core.config import Settings, get_settings
from app.core.logging import configure_logging
from app.db.database import Database
from app.infra.bus import RedisPublisher
from app.infra.corp_mcp import McpCorpServices
from app.infra.llm import embeddings as build_embeddings
from app.infra.llm import text_generator
from app.service.knowledge import KnowledgeService
from app.service.nudges import Nudges, ScheduledJob, run_due
from app.service.outbox import OutboxDispatcher, build_handlers

logger = logging.getLogger("app.worker")

_KEEP_DEAD_SESSIONS = timedelta(days=7)
CONFLICT_TOPICS = ["code_review.rules", "git.branches", "access.process"]


def maintenance_jobs(db: Database, settings: Settings) -> list[ScheduledJob]:
    embedder = build_embeddings(settings)
    generator = text_generator(settings)

    async def cleanup_sessions() -> int:
        async with db.unit_of_work() as uow:
            return await uow.sessions.delete_stale(before=datetime.now(UTC) - _KEEP_DEAD_SESSIONS)

    async def embed_backfill() -> int:
        async with db.unit_of_work() as uow:
            return await KnowledgeService(uow, embedder).embed_pending()

    async def detect_conflicts() -> int:
        if generator is None:
            return 0
        async with db.unit_of_work() as uow:
            return await KnowledgeService(uow, embedder).detect_conflicts(
                generator, CONFLICT_TOPICS
            )

    return [
        ScheduledJob("sessions-cleanup", timedelta(hours=1), cleanup_sessions),
        ScheduledJob("embed-backfill", timedelta(minutes=5), embed_backfill),
        ScheduledJob("conflict-check", timedelta(hours=12), detect_conflicts),
    ]


async def run_worker(settings: Settings) -> None:
    """
    Separate process (`python -m app.worker`), same image as the API: outbox delivery plus the
    AI-cron. Safe to run several copies: events are claimed with SKIP LOCKED and jobs take
    advisory locks.
    """
    db = Database(settings)
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    corp = McpCorpServices(settings.corp_mcp_url, timeout_sec=settings.corp_timeout_sec)
    handlers, dead = build_handlers(
        db=db,
        corp=corp,
        publisher=RedisPublisher(redis),
        embeddings=build_embeddings(settings),
        settings=settings,
    )
    dispatcher = OutboxDispatcher(
        db,
        handlers,
        dead_handlers=dead,
        batch_size=settings.outbox_batch_size,
        max_attempts=settings.outbox_max_attempts,
    )
    jobs = [
        *Nudges(db, corp, settings, generator=text_generator(settings)).jobs(),
        *maintenance_jobs(db, settings),
    ]
    next_runs: dict[str, datetime] = {}

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)

    logger.info("worker started")
    while not stop.is_set():
        processed = 0
        try:
            processed = await dispatcher.run_once()
            await run_due(jobs, next_runs, datetime.now(UTC))
        except Exception:  # a DB blip must not kill the worker; log and keep polling
            logger.exception("worker iteration failed")
        if processed == 0:
            with suppress(TimeoutError):
                await asyncio.wait_for(stop.wait(), timeout=settings.outbox_poll_interval_sec)

    await redis.aclose()
    await db.dispose()
    logger.info("worker stopped")


def main() -> None:
    settings = get_settings()
    configure_logging(settings.log_level, as_json=settings.log_json)
    asyncio.run(run_worker(settings))


if __name__ == "__main__":
    main()
