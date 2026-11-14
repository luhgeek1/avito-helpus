from datetime import date
from typing import Self
from uuid import UUID

from pydantic import Field

from app.api.schemas.base import ResponseModel
from app.domain.flags import FlagDecision
from app.domain.users import ROLE_TITLES, CurrentUser, Person, Role


class PersonRefOut(ResponseModel):
    id: UUID
    full_name: str
    title: str
    email: str


class TeamOut(ResponseModel):
    id: UUID
    slug: str
    name: str
    channel: str


class PersonOut(ResponseModel):
    id: UUID
    email: str
    full_name: str
    title: str
    role: Role
    role_title: str
    track: str
    start_date: date | None
    team: TeamOut | None
    mentor: PersonRefOut | None
    lead: PersonRefOut | None
    hrbp: PersonRefOut | None

    @classmethod
    def from_domain(cls, person: Person) -> Self:
        return cls.model_validate(
            {
                **{f: getattr(person, f) for f in person.__dataclass_fields__},
                "role_title": ROLE_TITLES[person.role],
            }
        )


class FlagDecisionOut(ResponseModel):
    key: str
    enabled: bool
    variant: str | None


class MeOut(PersonOut):
    internship_day: int | None = Field(description="Calendar day of the internship, from 1")
    permissions: list[str]
    flags: dict[str, FlagDecisionOut]
    assistant_mode: str = Field(description="online (LLM) or offline (rule-based, no key)")

    @classmethod
    def build(
        cls,
        person: Person,
        actor: CurrentUser,
        *,
        today: date,
        flags: dict[str, FlagDecision],
        assistant_mode: str,
    ) -> Self:
        base = PersonOut.from_domain(person).model_dump()
        return cls.model_validate(
            {
                **base,
                "internship_day": person.internship_day(today),
                "permissions": sorted(p.value for p in actor.permissions),
                "flags": {key: FlagDecisionOut.model_validate(d) for key, d in flags.items()},
                "assistant_mode": assistant_mode,
            }
        )
