from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import (
    ChatRuntimeDep,
    CurrentUserDep,
    FlagServiceDep,
    PeopleServiceDep,
    PlanServiceDep,
    require,
)
from app.api.schemas.people import MeOut, PersonOut
from app.api.schemas.plan import PlanOut
from app.core.clock import today
from app.domain.users import CurrentUser, Permission

router = APIRouter(tags=["Me"])


@router.get(path="/me", summary="Who I am: role, team, mentor, permissions, flags, assistant mode")
async def me(
    user: CurrentUserDep,
    people: PeopleServiceDep,
    flags: FlagServiceDep,
    chat: ChatRuntimeDep,
) -> MeOut:
    person = await people.person(user.id)
    unit = person.team.slug if person.team else "none"
    return MeOut.build(
        person,
        user,
        today=today(),
        flags=await flags.decisions(unit),
        assistant_mode=chat.mode.value,
    )


@router.get(path="/team", summary="Members of my team")
async def team(user: CurrentUserDep, people: PeopleServiceDep) -> list[PersonOut]:
    return [PersonOut.from_domain(p) for p in await people.team(user)]


@router.get(
    path="/plan", summary="My adaptation plan: stages, statuses, progress and the next steps"
)
async def plan(
    user: Annotated[CurrentUser, Depends(require(Permission.PLAN_OWN))], svc: PlanServiceDep
) -> PlanOut:
    return PlanOut.from_domain(await svc.overview(user.id, on=today()))
