import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from redis.asyncio import Redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


def _channel(user_id: str) -> str:
    return f"buddy:user:{user_id}"


class RedisPublisher:
    """Fan-out of realtime events to every open SSE stream of a user, across API replicas."""

    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    async def publish(self, user_id: str, event: str, data: dict[str, Any]) -> None:
        message = json.dumps({"event": event, "data": data}, ensure_ascii=False, default=str)
        try:
            await self._redis.publish(_channel(user_id), message)
        except RedisError:
            # Realtime is best effort: the notification row is already committed.
            logger.warning("realtime publish failed for %s", user_id, exc_info=True)


async def subscribe(redis: Redis, user_id: str) -> AsyncIterator[dict[str, Any]]:
    pubsub = redis.pubsub()
    await pubsub.subscribe(_channel(user_id))
    try:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            raw = message["data"]
            yield json.loads(raw if isinstance(raw, str) else raw.decode())
    finally:
        await pubsub.unsubscribe(_channel(user_id))
        await pubsub.aclose()  # type: ignore[no-untyped-call]
