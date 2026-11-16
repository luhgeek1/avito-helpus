"""Office booking: a desk for the day, or a room when both the intern and the mentor are free."""

from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from app.core.clock import LOCAL_TZ, utcnow
from app.db.models import User
from app.db.uow import UnitOfWork
from app.domain.office import (
    MAX_ROOM_MINUTES,
    BookingKind,
    Desk,
    Interval,
    NoFreeSlotError,
    Room,
    ensure_bookable_day,
    free_slots,
)
from app.domain.requests import RequestKind, RequestSource, RequestView
from app.domain.users import CurrentUser, UserNotFoundError
from app.service.ports import CorpServices
from app.service.requests import RequestService

BOOKING_SERVICE = "Сервис бронирования"
MENTOR_MEETING = "1:1 с наставником"
TAKEN = "Это место уже заняли, пока ты подтверждал. Попроси меня подобрать другое"
# How many candidate slots to ask the booking service about before giving up on a day.
MAX_SLOT_PROBES = 8


@dataclass(frozen=True, slots=True)
class Attendee:
    email: str
    name: str


@dataclass(frozen=True, slots=True)
class BookingOption:
    kind: BookingKind
    day: date
    start: str
    end: str
    rooms: list[Room] = field(default_factory=list)
    desks: list[Desk] = field(default_factory=list)
    attendees: list[Attendee] = field(default_factory=list)

    @property
    def names(self) -> list[str]:
        return [r.name for r in self.rooms] or [d.name for d in self.desks]


def _clock(value: datetime) -> str:
    return f"{value:%H:%M}"


def _parse_clock(value: str) -> time:
    hour, minute = value.strip().replace(".", ":").split(":")
    return time(int(hour), int(minute))


def _span_minutes(day: date, start: str, end: str) -> int:
    begins = datetime.combine(day, _parse_clock(start))
    ends = datetime.combine(day, _parse_clock(end))
    return int((ends - begins).total_seconds() // 60)


class OfficeService:
    def __init__(self, uow: UnitOfWork, corp: CorpServices, *, access_sla_hours: float) -> None:
        self._uow = uow
        self._corp = corp
        self._access_sla = access_sla_hours

    async def options(
        self,
        actor: CurrentUser,
        *,
        kind: BookingKind,
        day: date,
        start: str | None = None,
        minutes: int = 30,
        with_mentor: bool = False,
        today: date,
    ) -> BookingOption:
        ensure_bookable_day(day, today)
        if kind is BookingKind.DESK:
            desks = await self._corp.free_desks(day=day)
            if not desks:
                raise NoFreeSlotError("На этот день свободных мест нет — выбери другой день")
            return BookingOption(kind=kind, day=day, start="09:00", end="20:00", desks=desks)
        minutes = max(30, min(minutes, MAX_ROOM_MINUTES))
        user = await self._user(actor)
        attendees = await self._attendees(user, with_mentor=with_mentor)
        if start:
            begins = datetime.combine(day, _parse_clock(start), tzinfo=LOCAL_TZ)
            slots = [Interval(begins, begins + timedelta(minutes=minutes))]
        else:
            busy = await self._busy([user.email, *(a.email for a in attendees)], day)
            now = utcnow().astimezone(LOCAL_TZ)
            slots = free_slots(
                busy,
                day,
                timedelta(minutes=minutes),
                tz=LOCAL_TZ,
                not_before=now if day == now.date() else None,
            )
        for slot in slots[:MAX_SLOT_PROBES]:
            rooms = await self._corp.free_rooms(
                day=day,
                start=_clock(slot.start),
                end=_clock(slot.end),
                capacity=1 + len(attendees),
            )
            if rooms:
                # The smallest room that fits: big rooms stay free for big meetings.
                rooms.sort(key=lambda r: (r.capacity, r.name))
                return BookingOption(
                    kind=kind,
                    day=day,
                    start=_clock(slot.start),
                    end=_clock(slot.end),
                    rooms=rooms,
                    attendees=attendees,
                )
        raise NoFreeSlotError()

    async def create(
        self,
        actor: CurrentUser,
        *,
        kind: BookingKind,
        resource: str,
        day: date,
        start: str,
        end: str,
        title: str,
        with_mentor: bool,
        idempotency_key: str,
        source: RequestSource,
        today: date,
    ) -> RequestView:
        """Checks once more that the place is still free, then sends the booking."""
        existing = await self._uow.requests.by_idempotency_key(idempotency_key)
        if existing is None:
            minutes = _span_minutes(day, start, end)
            try:
                option = await self.options(
                    actor,
                    kind=kind,
                    day=day,
                    start=start if kind is BookingKind.ROOM else None,
                    minutes=minutes,
                    with_mentor=with_mentor,
                    today=today,
                )
            except NoFreeSlotError as exc:
                raise NoFreeSlotError(TAKEN) from exc
            free = {r.id: r.name for r in option.rooms} | {d.id: d.name for d in option.desks}
            if resource not in free:
                raise NoFreeSlotError(TAKEN)
            attendees = option.attendees
            name = free[resource]
        else:
            attendees = [Attendee(**a) for a in existing.payload.get("attendees", [])]
            name = existing.payload.get("name", resource)
        when = f"{day:%d.%m} {start}–{end}" if kind is BookingKind.ROOM else f"{day:%d.%m}"
        return await RequestService(
            self._uow, self._corp, access_sla_hours=self._access_sla
        ).create_tracked(
            actor,
            kind=RequestKind.BOOKING,
            title=f"Бронь: {name}, {when}",
            payload={
                "kind": kind.value,
                "resource": resource,
                "name": name,
                "date": day.isoformat(),
                "start": start,
                "end": end,
                "title": title,
                "attendees": [{"email": a.email, "name": a.name} for a in attendees],
            },
            approver=", ".join(a.name for a in attendees) or BOOKING_SERVICE,
            plan_item_id=None,
            idempotency_key=idempotency_key,
            source=source,
        )

    async def _busy(self, emails: list[str], day: date) -> list[Interval]:
        busy = []
        for email in emails:
            for event in await self._corp.calendar_events(employee=email, start=day, end=day):
                starts = (
                    event.starts_at.replace(tzinfo=LOCAL_TZ)
                    if event.starts_at.tzinfo is None
                    else event.starts_at.astimezone(LOCAL_TZ)
                )
                busy.append(Interval(starts, starts + timedelta(minutes=event.minutes)))
        return busy

    async def _attendees(self, user: User, *, with_mentor: bool) -> list[Attendee]:
        if not with_mentor or user.mentor_id is None:
            return []
        mentor = await self._uow.people.get(user.mentor_id)
        return [Attendee(mentor.email, mentor.full_name)] if mentor else []

    async def _user(self, actor: CurrentUser) -> User:
        user = await self._uow.people.get(actor.id)
        if user is None:
            raise UserNotFoundError()
        return user
