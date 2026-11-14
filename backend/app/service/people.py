from uuid import UUID

from app.db.models import User
from app.db.uow import UnitOfWork
from app.domain.users import (
    CurrentUser,
    MemberLinks,
    Person,
    UserNotFoundError,
    ensure_can_view_member,
)
from app.service.mappers import to_links, to_person


class PeopleService:
    def __init__(self, uow: UnitOfWork) -> None:
        self._uow = uow

    async def user(self, user_id: UUID) -> User:
        user = await self._uow.people.get(user_id)
        if user is None:
            raise UserNotFoundError()
        return user

    async def person(self, user_id: UUID) -> Person:
        user = await self.user(user_id)
        return await self.describe(user)

    async def describe(self, user: User) -> Person:
        team = await self._uow.people.team(user.team_id)
        people = await self._uow.people.get_many([user.mentor_id, user.lead_id, user.hrbp_id])
        return to_person(user, team=team, people=people)

    async def team(self, actor: CurrentUser) -> list[Person]:
        if actor.team_id is None:
            return []
        members = await self._uow.people.team_members(actor.team_id)
        team = await self._uow.people.team(actor.team_id)
        people = await self._uow.people.get_many(
            [m.mentor_id for m in members]
            + [m.lead_id for m in members]
            + [m.hrbp_id for m in members]
        )
        return [to_person(member, team=team, people=people) for member in members]

    async def member(self, actor: CurrentUser, member_id: UUID) -> tuple[User, MemberLinks]:
        """Another employee the actor may look at (ABAC), or 404."""
        user = await self._uow.people.get(member_id)
        if user is None:
            raise UserNotFoundError()
        links = to_links(user)
        ensure_can_view_member(actor, links)
        return user, links
