# Narrow interface used by this project; aiokafka does not ship a py.typed marker.
from typing import Any

class ConsumerRecord:
    value: bytes
    key: bytes | None
    topic: str
    partition: int
    offset: int

class AIOKafkaProducer:
    def __init__(
        self, *, bootstrap_servers: str, enable_idempotence: bool, request_timeout_ms: int
    ) -> None: ...
    async def start(self) -> None: ...
    async def stop(self) -> None: ...
    async def send_and_wait(self, topic: str, value: bytes, *, key: bytes) -> Any: ...

class AIOKafkaConsumer:
    def __init__(
        self,
        *topics: str,
        bootstrap_servers: str,
        group_id: str,
        enable_auto_commit: bool,
        auto_offset_reset: str,
    ) -> None: ...
    async def start(self) -> None: ...
    async def stop(self) -> None: ...
    async def getone(self) -> ConsumerRecord: ...
    async def commit(self) -> None: ...
