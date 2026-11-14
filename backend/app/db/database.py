from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Protocol

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.errors import DomainError
from app.db.uow import UnitOfWork


class DatabaseSettings(Protocol):
    @property
    def database_url(self) -> str: ...
    @property
    def sql_echo(self) -> bool: ...
    @property
    def db_pool_size(self) -> int: ...
    @property
    def db_max_overflow(self) -> int: ...


class Database:
    def __init__(self, settings: DatabaseSettings) -> None:
        self.engine: AsyncEngine = create_async_engine(
            settings.database_url,
            echo=settings.sql_echo,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_pre_ping=True,
        )
        self._sessions = async_sessionmaker(self.engine, expire_on_commit=False, autoflush=False)

    @asynccontextmanager
    async def unit_of_work(self) -> AsyncIterator[UnitOfWork]:
        """Commit on success, roll back on any error (unless the error says to keep changes)."""
        async with self._sessions() as session:
            try:
                yield UnitOfWork(session)
            except DomainError as exc:
                if exc.keep_changes:
                    await session.commit()
                else:
                    await session.rollback()
                raise
            except BaseException:
                await session.rollback()
                raise
            await session.commit()

    async def ping(self) -> None:
        async with self.engine.connect() as connection:
            await connection.execute(text("SELECT 1"))

    async def dispose(self) -> None:
        await self.engine.dispose()

    def raw_session(self) -> AsyncSession:
        """For tests and scripts that need a plain session outside the UoW rules."""
        return self._sessions()
