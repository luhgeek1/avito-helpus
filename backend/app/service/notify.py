from typing import Any
from uuid import UUID

from app.core.clock import utcnow
from app.db.uow import UnitOfWork
from app.domain.events import NotificationKind, RealtimeEvent, Topic


def push(uow: UnitOfWork, user_id: UUID, event: RealtimeEvent, data: dict[str, Any]) -> None:
    """Realtime event for the user's open tabs, delivered after commit by the worker."""
    uow.outbox.add(
        Topic.REALTIME_PUBLISH, {"user_id": str(user_id), "event": event.value, "data": data}
    )


async def notify(
    uow: UnitOfWork,
    *,
    user_id: UUID,
    kind: NotificationKind,
    title: str,
    body: str = "",
    link: str | None = None,
    payload: dict[str, Any] | None = None,
    dedupe_key: str | None = None,
) -> bool:
    """Store a notification and push it live. Returns False when the dedupe key was already used."""
    notification_id = await uow.notifications.add(
        user_id=user_id,
        kind=kind,
        title=title,
        body=body,
        link=link,
        payload=payload,
        dedupe_key=dedupe_key,
        now=utcnow(),
    )
    if notification_id is None:
        return False
    push(
        uow,
        user_id,
        RealtimeEvent.NOTIFICATION,
        {
            "id": str(notification_id),
            "kind": kind.value,
            "title": title,
            "body": body,
            "link": link,
            "payload": payload or {},
        },
    )
    return True
