from datetime import datetime

from app.db.database import Database
from app.domain.events import OutboxStatus, Topic
from app.infra.metrics import OUTBOX_BACKLOG, OUTBOX_OLDEST, OUTBOX_SNAPSHOT, metric_topic


async def refresh_outbox_metrics(db: Database, now: datetime) -> int:
    async with db.unit_of_work() as uow:
        rows = await uow.outbox.backlog()
    counts: dict[tuple[str, str], int] = {}
    ages: dict[str, float] = {}
    for topic, status, count, oldest in rows:
        label = metric_topic(topic)
        state = "pending" if status == OutboxStatus.PENDING else "failed"
        counts[label, state] = counts.get((label, state), 0) + count
        ages[label] = max(ages.get(label, 0), 0, (now - oldest).total_seconds())
    for label in [*Topic, "other"]:
        for state in ("pending", "failed"):
            OUTBOX_BACKLOG.labels(topic=label, state=state).set(counts.get((label, state), 0))
        OUTBOX_OLDEST.labels(topic=label).set(ages.get(label, 0))
    OUTBOX_SNAPSHOT.set(now.timestamp())
    return len(rows)
