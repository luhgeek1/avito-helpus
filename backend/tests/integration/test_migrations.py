from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.base import Base
from tests.conftest import TEST_DATABASE_URL
from tests.integration.conftest import alembic_config


def _diff(connection: Connection) -> list[object]:
    context = MigrationContext.configure(connection, opts={"compare_type": True})
    return list(compare_metadata(context, Base.metadata))


async def test_models_match_migrations() -> None:
    """Fails when a model changed but nobody wrote the migration for it."""
    engine = create_async_engine(TEST_DATABASE_URL)
    try:
        async with engine.connect() as connection:
            diff = await connection.run_sync(_diff)
    finally:
        await engine.dispose()

    assert diff == []


def test_downgrade_and_upgrade_again() -> None:
    config = alembic_config()

    command.downgrade(config, "base")
    command.upgrade(config, "head")
