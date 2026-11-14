import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from enum import StrEnum

from app.core.errors import ConflictError, DomainError, ErrorCode


class AbsenceType(StrEnum):
    DAY_OFF = "day_off"
    VACATION = "vacation"


ABSENCE_TITLES: Mapping[AbsenceType, str] = {
    AbsenceType.DAY_OFF: "Отгул",
    AbsenceType.VACATION: "Отпуск",
}

# Synthetic "test instruction" rules (not Avito policy): notice period in working days,
# longest continuous absence and the probation restriction.
NOTICE_WORKING_DAYS: Mapping[AbsenceType, int] = {AbsenceType.DAY_OFF: 2, AbsenceType.VACATION: 10}
MAX_CONSECUTIVE_DAYS: Mapping[AbsenceType, int] = {AbsenceType.DAY_OFF: 3, AbsenceType.VACATION: 28}
VACATION_AFTER_DAYS = 90
_SATURDAY = 5


@dataclass(frozen=True, slots=True)
class CalendarEvent:
    title: str
    starts_at: datetime
    important: bool


@dataclass(frozen=True, slots=True)
class AbsenceCheck:
    type: AbsenceType
    start: date
    end: date
    working_days: int
    balance: int
    balance_after: int
    warnings: list[str] = field(default_factory=list)
    conflicts: list[CalendarEvent] = field(default_factory=list)

    @property
    def title(self) -> str:
        if self.start == self.end:
            return f"{ABSENCE_TITLES[self.type]} {self.start:%d.%m.%Y}"
        return f"{ABSENCE_TITLES[self.type]} {self.start:%d.%m}–{self.end:%d.%m.%Y}"


class AbsenceDatesError(DomainError):
    status_code = 422
    error_code = ErrorCode.ABSENCE_INVALID_DATES
    default_detail = (
        "Check the dates: the absence must start today or later and end after it starts"
    )


class AbsenceBalanceError(ConflictError):
    error_code = ErrorCode.ABSENCE_BALANCE_EXCEEDED
    default_detail = "Not enough days left for this absence"


def working_days(start: date, end: date) -> int:
    days = (end - start).days + 1
    return sum(1 for offset in range(days) if (start + timedelta(offset)).weekday() < _SATURDAY)


def evaluate_absence(
    *,
    type_: AbsenceType,
    start: date,
    end: date,
    today: date,
    internship_start: date | None,
    balance: int,
    events: Sequence[CalendarEvent],
) -> AbsenceCheck:
    """Hard errors for impossible requests, warnings for rules a lead may still approve."""
    if start < today or end < start:
        raise AbsenceDatesError()
    days = working_days(start, end)
    if days == 0:
        raise AbsenceDatesError("These dates are a weekend: no absence request is needed")
    if days > balance:
        raise AbsenceBalanceError(f"You have {balance} days left, the request needs {days}")

    warnings: list[str] = []
    notice = NOTICE_WORKING_DAYS[type_]
    if working_days(today, start - timedelta(days=1)) < notice:
        warnings.append(
            f"По тестовой инструкции {ABSENCE_TITLES[type_].lower()} подаётся минимум за {notice} "
            "рабочих дня — предупреди руководителя лично."
        )
    if days > MAX_CONSECUTIVE_DAYS[type_]:
        warnings.append(
            f"Больше {MAX_CONSECUTIVE_DAYS[type_]} дней подряд — согласуй заранее с руководителем."
        )
    if (
        type_ is AbsenceType.VACATION
        and internship_start is not None
        and (start - internship_start).days < VACATION_AFTER_DAYS
    ):
        warnings.append(
            "Отпуск в первые три месяца стажировки — только по согласованию с руководителем."
        )

    conflicts = [
        event for event in events if event.important and start <= event.starts_at.date() <= end
    ]
    warnings.extend(
        f"В эти дни {event.title} ({event.starts_at:%d.%m %H:%M}) — "
        "предупреди участников или перенеси."
        for event in conflicts
    )
    return AbsenceCheck(
        type=type_,
        start=start,
        end=end,
        working_days=days,
        balance=balance,
        balance_after=balance - days,
        warnings=warnings,
        conflicts=conflicts,
    )


_MONTHS = {
    "январ": 1, "феврал": 2, "март": 3, "апрел": 4, "ма": 5, "июн": 6,
    "июл": 7, "август": 8, "сентябр": 9, "октябр": 10, "ноябр": 11, "декабр": 12,
}  # fmt: skip
_WEEKDAYS = {
    "понедельник": 0, "вторник": 1, "сред": 2, "четверг": 3, "пятниц": 4, "суббот": 5,
    "воскресень": 6,
}  # fmt: skip
_NUMERIC = re.compile(r"(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?")
_WORDS = re.compile(
    r"(\d{1,2})\s+(январ\w*|феврал\w*|март\w*|апрел\w*|ма[яй]\w*|июн\w*|июл\w*|"
    r"август\w*|сентябр\w*|октябр\w*|ноябр\w*|декабр\w*)"
)
_RANGE_SAME_MONTH = re.compile(r"с\s+(\d{1,2})\s+по\s+(\d{1,2})\s+([а-яё]+)")


def _month(word: str) -> int | None:
    for prefix, number in _MONTHS.items():
        if word.startswith(prefix) and (prefix != "ма" or word[:3] in {"мая", "май"}):
            return number
    return None


def _future(day: int, month: int, today: date, year: int | None = None) -> date | None:
    try:
        candidate = date(year or today.year, month, day)
    except ValueError:
        return None
    if year is None and candidate < today:
        candidate = candidate.replace(year=today.year + 1)
    return candidate


def _explicit_dates(text: str, today: date) -> list[date]:
    found: list[date] = []
    if match := _RANGE_SAME_MONTH.search(text):
        month = _month(match.group(3))
        if month:
            first = _future(int(match.group(1)), month, today)
            last = _future(int(match.group(2)), month, today)
            return [d for d in (first, last) if d]
    for match in _NUMERIC.finditer(text):
        year = int(match.group(3)) if match.group(3) else None
        if year is not None and year < 100:  # noqa: PLR2004 - two-digit year
            year += 2000
        if parsed := _future(int(match.group(1)), int(match.group(2)), today, year):
            found.append(parsed)
    for match in _WORDS.finditer(text):
        month = _month(match.group(2))
        if month and (parsed := _future(int(match.group(1)), month, today)):
            found.append(parsed)
    return found


def parse_dates_ru(text: str, today: date) -> tuple[date, date] | None:
    """Dates from Russian phrases: "завтра", "в пятницу", "12.12", "с 20 по 22 ноября"."""  # noqa: RUF002
    lowered = text.lower()
    dates = _explicit_dates(lowered, today)
    if dates:
        dates.sort()
        return dates[0], dates[-1]
    if "послезавтра" in lowered:
        day = today + timedelta(days=2)
        return day, day
    if "завтра" in lowered:
        day = today + timedelta(days=1)
        return day, day
    if "сегодня" in lowered:
        return today, today
    for stem, weekday in _WEEKDAYS.items():
        if stem in lowered:
            ahead = (weekday - today.weekday()) % 7 or 7
            day = today + timedelta(days=ahead)
            return day, day
    return None
