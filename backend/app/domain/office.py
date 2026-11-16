"""Office booking rules: working days, a slot both people have free, room size."""

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, tzinfo
from enum import StrEnum

from app.core.errors import ConflictError, ErrorCode

DAY_START = time(10, 0)
DAY_END = time(19, 0)
LUNCH = (time(13, 0), time(14, 0))
STEP = timedelta(minutes=30)
MAX_DAYS_AHEAD = 30
MAX_ROOM_MINUTES = 120
WORKING_WEEK = 5


class BookingKind(StrEnum):
    DESK = "desk"
    ROOM = "room"


BOOKING_TITLES: Mapping[BookingKind, str] = {
    BookingKind.DESK: "Рабочее место",
    BookingKind.ROOM: "Переговорка",
}


@dataclass(frozen=True, slots=True)
class Room:
    id: str
    name: str
    floor: int
    capacity: int
    equipment: str


@dataclass(frozen=True, slots=True)
class Desk:
    id: str
    name: str
    floor: int
    zone: str


@dataclass(frozen=True, slots=True)
class Interval:
    start: datetime
    end: datetime

    def overlaps(self, other: "Interval") -> bool:
        return self.start < other.end and other.start < self.end


class BookingDateError(ConflictError):
    error_code = ErrorCode.CONFLICT
    default_detail = "Бронировать можно рабочие дни в ближайшие 30 дней, начиная с сегодняшнего"


class NoFreeSlotError(ConflictError):
    error_code = ErrorCode.CONFLICT
    default_detail = (
        "В этот день нет общего свободного времени или свободной переговорки — выбери другой день"
    )


def ensure_bookable_day(day: date, today: date) -> None:
    if day < today or day.weekday() >= WORKING_WEEK or (day - today).days > MAX_DAYS_AHEAD:
        raise BookingDateError()


def free_slots(
    busy: Iterable[Interval],
    day: date,
    duration: timedelta,
    *,
    tz: tzinfo,
    not_before: datetime | None = None,
) -> list[Interval]:
    """Half-hour aligned slots inside working hours, outside lunch and every busy interval."""
    busy = list(busy)
    lunch = Interval(
        datetime.combine(day, LUNCH[0], tzinfo=tz),
        datetime.combine(day, LUNCH[1], tzinfo=tz),
    )
    start = datetime.combine(day, DAY_START, tzinfo=tz)
    end = datetime.combine(day, DAY_END, tzinfo=tz)
    slots = []
    while start + duration <= end:
        slot = Interval(start, start + duration)
        if (
            (not_before is None or slot.start >= not_before)
            and not slot.overlaps(lunch)
            and not any(slot.overlaps(b) for b in busy)
        ):
            slots.append(slot)
        start += STEP
    return slots


def end_time(start: str, minutes: int) -> str:
    """ "15:30" + 30 minutes -> "16:00" (within one day)."""
    hour, minute = (int(part) for part in start.split(":"))
    total = hour * 60 + minute + minutes
    return f"{total // 60:02d}:{total % 60:02d}"
