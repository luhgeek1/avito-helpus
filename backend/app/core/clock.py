from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

# Deadlines and "today" are what an intern in Moscow sees; storage stays in UTC.
LOCAL_TZ = ZoneInfo("Europe/Moscow")


def utcnow() -> datetime:
    return datetime.now(UTC)


def today() -> date:
    return datetime.now(LOCAL_TZ).date()
