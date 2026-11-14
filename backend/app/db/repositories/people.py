from collections.abc import Iterable, Sequence
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Team, User
from app.domain.users import Role


class PeopleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add(self, user: User) -> None:
        self._session.add(user)

    def add_team(self, team: Team) -> None:
        self._session.add(team)

    async def get(self, user_id: UUID, *, for_update: bool = False) -> User | None:
        if not for_update:
            return await self._session.get(User, user_id)
        stmt = (
            select(User)
            .where(User.id == user_id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        return await self._session.scalar(stmt)

    async def get_by_email(self, email: str) -> User | None:
        return await self._session.scalar(select(User).where(User.email == email))

    async def get_many(self, ids: Iterable[UUID | None]) -> dict[UUID, User]:
        wanted = {i for i in ids if i is not None}
        if not wanted:
            return {}
        rows = await self._session.scalars(select(User).where(User.id.in_(wanted)))
        return {user.id: user for user in rows}

    async def team(self, team_id: UUID | None) -> Team | None:
        return await self._session.get(Team, team_id) if team_id else None

    async def team_by_slug(self, slug: str) -> Team | None:
        return await self._session.scalar(select(Team).where(Team.slug == slug))

    async def teams(self, ids: Iterable[UUID | None]) -> dict[UUID, Team]:
        wanted = {i for i in ids if i is not None}
        if not wanted:
            return {}
        rows = await self._session.scalars(select(Team).where(Team.id.in_(wanted)))
        return {team.id: team for team in rows}

    async def team_members(self, team_id: UUID) -> Sequence[User]:
        stmt = select(User).where(User.team_id == team_id).order_by(User.full_name)
        return (await self._session.scalars(stmt)).all()

    async def team_lead(self, team_id: UUID) -> User | None:
        stmt = select(User).where(User.team_id == team_id, User.role == Role.LEAD).limit(1)
        return await self._session.scalar(stmt)

    async def interns_visible_to(self, actor_id: UUID, role: Role) -> Sequence[User]:
        """Interns linked to the actor: mentees, the lead's team interns, the HRBP's interns."""
        stmt = select(User).where(User.role == Role.INTERN)
        if role is not Role.ADMIN:
            stmt = stmt.where(
                or_(User.mentor_id == actor_id, User.lead_id == actor_id, User.hrbp_id == actor_id)
            )
        return (await self._session.scalars(stmt.order_by(User.full_name))).all()

    async def interns(self) -> Sequence[User]:
        stmt = select(User).where(User.role == Role.INTERN, User.banned_at.is_(None))
        return (await self._session.scalars(stmt)).all()
