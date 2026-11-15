"""Disposable SDK browser fixture on the test DB; never points at development data."""

import asyncio
from contextlib import asynccontextmanager, suppress
from pathlib import Path

from fastapi import FastAPI

from app.knowledge_import import import_knowledge, read_knowledge
from app.main import create_app
from app.seed.loader import seed
from app.worker import run_worker
from tests.conftest import build_settings

settings = build_settings(
    database_url="postgresql+asyncpg://postgres:secret@localhost:5439/buddy_test",
    redis_url="redis://localhost:6380/0",
    corp_mcp_url="http://127.0.0.1:8099/mcp",
    corp_webhook_secret="dev-webhook-secret",
    worker_metrics_enabled=False,
    outbox_poll_interval_sec=0.2,
)
app = create_app(settings)
original_lifespan = app.router.lifespan_context
KNOWLEDGE_DIRECTORY = Path(__file__).resolve().parents[2] / "docs/integration/knowledge-example"


@asynccontextmanager
async def lifespan(application: FastAPI):
    async with original_lifespan(application):
        await seed(application.state.db, reset=True)
        await import_knowledge(application.state.db, read_knowledge(KNOWLEDGE_DIRECTORY))
        worker = asyncio.create_task(run_worker(settings))
        try:
            yield
        finally:
            worker.cancel()
            with suppress(asyncio.CancelledError):
                await worker


app.router.lifespan_context = lifespan
