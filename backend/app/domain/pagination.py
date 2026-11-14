import base64
import binascii
from dataclasses import dataclass
from datetime import datetime
from typing import Self
from uuid import UUID

from app.core.errors import DomainError, ErrorCode


class InvalidCursorError(DomainError):
    error_code = ErrorCode.INVALID_CURSOR
    default_detail = "Invalid cursor"


@dataclass(frozen=True, slots=True)
class Cursor:
    """Keyset position `(created_at, id)`; opaque to clients so we can change it later."""

    created_at: datetime
    id: UUID

    def encode(self) -> str:
        raw = f"{self.created_at.isoformat()}|{self.id}".encode()
        return base64.urlsafe_b64encode(raw).decode().rstrip("=")

    @classmethod
    def decode(cls, value: str) -> Self:
        try:
            raw = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)).decode()
            created_at, _, item_id = raw.partition("|")
            cursor = cls(created_at=datetime.fromisoformat(created_at), id=UUID(item_id))
        except (binascii.Error, UnicodeDecodeError, ValueError) as exc:
            raise InvalidCursorError() from exc
        if cursor.created_at.tzinfo is None:
            raise InvalidCursorError()
        return cursor


@dataclass(frozen=True, slots=True)
class Page[T]:
    items: list[T]
    next_cursor: str | None
