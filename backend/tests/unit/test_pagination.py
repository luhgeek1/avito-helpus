from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.domain.pagination import Cursor, InvalidCursorError


def test_cursor_round_trip() -> None:
    cursor = Cursor(created_at=datetime(2026, 1, 2, 3, 4, 5, 6, tzinfo=UTC), id=uuid4())

    assert Cursor.decode(cursor.encode()) == cursor


@pytest.mark.parametrize("raw", ["", "%%%", "bm90LWEtY3Vyc29y", Cursor.__name__])
def test_garbage_cursor_is_rejected(raw: str) -> None:
    with pytest.raises(InvalidCursorError):
        Cursor.decode(raw)


def test_cursor_without_timezone_is_rejected() -> None:
    naive = Cursor(created_at=datetime(2026, 1, 1), id=uuid4())

    with pytest.raises(InvalidCursorError):
        Cursor.decode(naive.encode())
