from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer

from app.core.clock import LOCAL_TZ


def _moscow_datetime(value: datetime) -> datetime:
    return value.replace(tzinfo=LOCAL_TZ) if value.tzinfo is None else value.astimezone(LOCAL_TZ)


MoscowDateTime = Annotated[datetime, PlainSerializer(_moscow_datetime, when_used="json")]


class RequestModel(BaseModel):
    """Request bodies: unknown fields are an error, so client typos don't pass silently."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ResponseModel(BaseModel):
    """Response bodies are built from domain dataclasses, never from ORM objects."""

    model_config = ConfigDict(from_attributes=True)


class CursorPage[T](BaseModel):
    items: list[T]
    next_cursor: str | None = None
