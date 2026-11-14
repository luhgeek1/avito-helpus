from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis
from sqlalchemy import text

from app.core.config import Settings
from app.db.base import Base
from app.db.database import Database
from app.domain.corp import AccessGrant, EquipmentStatus
from app.main import create_app
from app.seed.loader import seed
from app.service.outbox import OutboxDispatcher, build_handlers
from tests.conftest import TEST_DATABASE_URL, build_settings
from tests.fakes import FakeCorpServices, FakeEmbeddings, RecordingPublisher, laptop

BACKEND_DIR = Path(__file__).resolve().parents[2]
PASSWORD = "orbi-demo-2026"
ANYA = "anya.intern@buddy.test"
KIRILL = "kirill.intern@buddy.test"
DANA = "dana.intern@buddy.test"
IVAN = "ivan.mentor@buddy.test"
MARIA = "maria.lead@buddy.test"
OLGA = "olga.hrbp@buddy.test"
PAVEL = "pavel.mentor@buddy.test"
ADMIN = "admin@buddy.test"


def alembic_config(database_url: str = TEST_DATABASE_URL) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.attributes["database_url"] = database_url
    config.attributes["configure_logger"] = False
    return config


@pytest.fixture(scope="session", autouse=True)
def _migrated_database() -> None:
    """Schema comes from the real migrations, so tests also prove the migrations work."""
    command.upgrade(alembic_config(), "head")


async def _reset_state(settings: Settings) -> None:
    db = Database(settings)
    try:
        async with db.raw_session() as session:
            tables = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
            await session.execute(text(f"TRUNCATE {tables} CASCADE"))
            await session.commit()
    finally:
        await db.dispose()
    redis = Redis.from_url(settings.redis_url)
    try:
        await redis.flushdb()
    finally:
        await redis.aclose()


def demo_corp() -> FakeCorpServices:
    """The same starting point as corp-mock/data/seed.json."""
    return FakeCorpServices(
        grants={(ANYA, "jira-listings"): AccessGrant(has_access=True, level="write")},
        balances={ANYA: 5, KIRILL: 4, DANA: 3},
        equipment_items={ANYA: [laptop(EquipmentStatus.IN_TRANSIT)]},
    )


@asynccontextmanager
async def running_app(
    settings: Settings, corp: FakeCorpServices, embeddings: Any = None
) -> AsyncIterator[tuple[FastAPI, AsyncClient]]:
    """Clean database, the real app with its lifespan and fakes, the demo company seeded."""
    await _reset_state(build_settings())
    app = create_app(settings, corp=corp, embeddings=embeddings)
    async with app.router.lifespan_context(app):
        await seed(app.state.db)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            yield app, client


AppFactory = Callable[..., AbstractAsyncContextManager[tuple[FastAPI, AsyncClient]]]


@pytest.fixture
def corp() -> FakeCorpServices:
    return demo_corp()


@pytest.fixture
def embeddings() -> FakeEmbeddings | None:
    return None


@pytest.fixture
def app_factory(corp: FakeCorpServices) -> AppFactory:
    """For tests that need non-default settings: `async with app_factory(x=1) as (app, client)`."""

    def factory(**overrides: Any) -> AbstractAsyncContextManager[tuple[FastAPI, AsyncClient]]:
        embeddings = overrides.pop("embeddings", None)
        return running_app(build_settings(**overrides), corp, embeddings)

    return factory


@pytest.fixture
async def _running(
    settings: Settings, corp: FakeCorpServices, embeddings: FakeEmbeddings | None
) -> AsyncIterator[tuple[FastAPI, AsyncClient]]:
    async with running_app(settings, corp, embeddings) as pair:
        yield pair


@pytest.fixture
def app(_running: tuple[FastAPI, AsyncClient]) -> FastAPI:
    return _running[0]


@pytest.fixture
def client(_running: tuple[FastAPI, AsyncClient]) -> AsyncClient:
    return _running[1]


@pytest.fixture
def db(app: FastAPI) -> Database:
    database: Database = app.state.db
    return database


@pytest.fixture
def publisher() -> RecordingPublisher:
    return RecordingPublisher()


@pytest.fixture
def run_outbox(
    db: Database, corp: FakeCorpServices, publisher: RecordingPublisher, settings: Settings
) -> Callable[[], Awaitable[int]]:
    """One worker iteration in the test: `await run_outbox()` delivers pending events."""
    handlers, dead = build_handlers(
        db=db, corp=corp, publisher=publisher, embeddings=None, settings=settings
    )
    dispatcher = OutboxDispatcher(db, handlers, dead_handlers=dead, batch_size=100, max_attempts=2)
    return dispatcher.run_once


@dataclass(frozen=True)
class Account:
    id: str
    email: str
    access_token: str
    refresh_token: str | None

    @property
    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.access_token}"}


async def login(client: AsyncClient, email: str, password: str = PASSWORD) -> Account:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
        headers={"X-Client": "mobile"},
    )
    assert response.status_code == 200, response.text
    tokens = response.json()
    me = await client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200, me.text
    return Account(
        id=me.json()["id"],
        email=email,
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
    )


@pytest.fixture
async def anya(client: AsyncClient) -> Account:
    return await login(client, ANYA)


@pytest.fixture
async def kirill(client: AsyncClient) -> Account:
    return await login(client, KIRILL)


@pytest.fixture
async def dana(client: AsyncClient) -> Account:
    return await login(client, DANA)


@pytest.fixture
async def ivan(client: AsyncClient) -> Account:
    return await login(client, IVAN)


@pytest.fixture
async def maria(client: AsyncClient) -> Account:
    return await login(client, MARIA)


@pytest.fixture
async def olga(client: AsyncClient) -> Account:
    return await login(client, OLGA)


@pytest.fixture
async def admin(client: AsyncClient) -> Account:
    return await login(client, ADMIN)
