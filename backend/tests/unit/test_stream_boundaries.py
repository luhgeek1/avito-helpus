import asyncio
import json
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from app.api.v1 import people_ops
from app.domain.users import CurrentUser, Role


@pytest.mark.parametrize("with_message", [False, True])
async def test_events_send_keepalive_or_user_event_and_close_pump(
    with_message: bool,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = CurrentUser(uuid4(), Role.INTERN, uuid4())
    request = SimpleNamespace(
        headers={"authorization": "Bearer test"},
        is_disconnected=AsyncMock(return_value=False),
    )

    @asynccontextmanager
    async def unit_of_work():
        yield object()

    closed = asyncio.Event()

    async def subscribe(redis, user_id):
        assert user_id == str(user.id)
        try:
            if with_message:
                yield {"event": "notification.created", "data": {"text": "Тестовое уведомление"}}
            await asyncio.Event().wait()
        finally:
            closed.set()

    monkeypatch.setattr(people_ops, "subscribe", subscribe)
    monkeypatch.setattr(people_ops, "resolve_current_user", AsyncMock(return_value=user))
    monkeypatch.setattr(people_ops, "KEEPALIVE_SEC", 0.01)
    response = await people_ops.events(
        request,
        user,
        object(),
        SimpleNamespace(unit_of_work=unit_of_work),
        SimpleNamespace(decode_access=Mock(return_value=object())),
    )
    iterator = response.body_iterator
    assert await anext(iterator) == "retry: 3000\n\n"
    message = await anext(iterator)
    if with_message:
        assert message.startswith("event: notification.created\n")
        assert json.loads(message.split("data: ", 1)[1])["text"] == "Тестовое уведомление"
    else:
        assert message == ": keepalive\n\n"
        request.is_disconnected.return_value = True
        with pytest.raises(StopAsyncIteration):
            await anext(iterator)
    await iterator.aclose()
    assert closed.is_set()


async def test_events_recheck_authorization_before_delivering_queued_data(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.domain.auth import SessionRevokedError  # noqa: PLC0415

    user = CurrentUser(uuid4(), Role.INTERN, uuid4())

    @asynccontextmanager
    async def unit_of_work():
        yield object()

    async def subscribe(redis, user_id):
        yield {"event": "notification.created", "data": {"private": "hidden"}}

    monkeypatch.setattr(people_ops, "subscribe", subscribe)
    monkeypatch.setattr(people_ops, "resolve_current_user", AsyncMock(return_value=user))
    response = await people_ops.events(
        SimpleNamespace(
            headers={"authorization": "Bearer test"}, is_disconnected=AsyncMock(return_value=False)
        ),
        user,
        object(),
        SimpleNamespace(unit_of_work=unit_of_work),
        SimpleNamespace(decode_access=Mock(side_effect=[object(), SessionRevokedError()])),
    )
    iterator = response.body_iterator
    await anext(iterator)
    assert await anext(iterator) == "event: auth.required\ndata: {}\n\n"
    with pytest.raises(StopAsyncIteration):
        await anext(iterator)
