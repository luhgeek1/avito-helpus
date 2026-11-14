from pydantic import BaseModel, ConfigDict


class RequestModel(BaseModel):
    """Request bodies: unknown fields are an error, so client typos don't pass silently."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ResponseModel(BaseModel):
    """Response bodies are built from domain dataclasses, never from ORM objects."""

    model_config = ConfigDict(from_attributes=True)


class CursorPage[T](BaseModel):
    items: list[T]
    next_cursor: str | None = None
