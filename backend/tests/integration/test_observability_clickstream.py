import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import create_async_engine

from app.db.database import Database
from app.db.models import AnalyticsEventRow, OutboxEvent
from app.domain.events import AnalyticsEvent, OutboxStatus, Topic
from app.infra.observability import provision_grafana
from app.service.ops import AnalyticsService
from app.service.outbox import OutboxDispatcher
from tests.conftest import build_settings
from tests.integration.conftest import Account, AppFactory, login


async def test_product_operation_atomically_enqueues_safe_envelope(app_factory: AppFactory) -> None:
    async with app_factory(clickstream_enabled=True, clickstream_hmac_key="x" * 32) as (
        app,
        client,
    ):
        actor = await login(client, "anya.intern@buddy.test")
        response = await client.post(
            "/api/v1/analytics/events",
            headers=actor.headers,
            json={
                "name": "plan.opened",
                "properties": {"email": "private@example.test", "text": "private"},
            },
        )
        assert response.status_code == 204
        async with app.state.db.unit_of_work() as uow:
            event = (
                await uow.session.scalars(
                    select(AnalyticsEventRow).where(
                        AnalyticsEventRow.name == AnalyticsEvent.UI_EVENT
                    )
                )
            ).one()
            out = (
                await uow.session.scalars(
                    select(OutboxEvent).where(OutboxEvent.topic == Topic.ANALYTICS_PUBLISH)
                )
            ).one()
        assert out.payload["event_id"] == str(event.id)
        assert out.payload["occurred_at"] == event.created_at.isoformat()
        assert out.payload["properties"] == {"name": "plan.opened"}
        assert actor.id not in str(out.payload)
        assert "private" not in str(out.payload)


async def test_event_and_outbox_roll_back_together(app_factory: AppFactory) -> None:
    async with app_factory(clickstream_enabled=True, clickstream_hmac_key="x" * 32) as (app, _):
        with pytest.raises(RuntimeError, match="rollback"):  # noqa: PT012 - transaction atomicity
            async with app.state.db.unit_of_work() as uow:
                uow.ops.track(AnalyticsEvent.CHAT_MESSAGE, user_id=None)
                await uow.flush()
                assert (
                    await uow.session.scalar(
                        select(func.count())
                        .select_from(OutboxEvent)
                        .where(OutboxEvent.topic == Topic.ANALYTICS_PUBLISH)
                    )
                    == 1
                )
                raise RuntimeError("rollback")
        async with app.state.db.unit_of_work() as uow:
            assert (
                await uow.session.scalar(select(func.count()).select_from(AnalyticsEventRow)) == 0
            )
            assert (
                await uow.session.scalar(
                    select(func.count())
                    .select_from(OutboxEvent)
                    .where(OutboxEvent.topic == Topic.ANALYTICS_PUBLISH)
                )
                == 0
            )


async def test_disabled_kafka_preserves_business_operation(
    client: AsyncClient, anya: Account, db: Database
) -> None:
    response = await client.post(
        "/api/v1/analytics/events", headers=anya.headers, json={"name": "plan.opened"}
    )
    assert response.status_code == 204
    async with db.unit_of_work() as uow:
        assert await uow.session.scalar(select(func.count()).select_from(AnalyticsEventRow)) == 1
        assert (
            await uow.session.scalar(
                select(func.count())
                .select_from(OutboxEvent)
                .where(OutboxEvent.topic == Topic.ANALYTICS_PUBLISH)
            )
            == 0
        )


async def test_delivery_outage_retry_recovery_and_disable_pause(app_factory: AppFactory) -> None:
    async with app_factory(clickstream_enabled=True, clickstream_hmac_key="x" * 32) as (app, _):
        db = app.state.db
        async with db.unit_of_work() as uow:
            uow.ops.track(AnalyticsEvent.CHAT_MESSAGE, user_id=None)
        publish = AsyncMock(side_effect=[ConnectionError("broker down"), None])

        async def handler(payload: dict) -> None:
            await publish(payload)

        paused = OutboxDispatcher(
            db,
            {},
            batch_size=1,
            max_attempts=1,
            deferred_topics=(Topic.ANALYTICS_PUBLISH,),
            only_topics=(Topic.ANALYTICS_PUBLISH,),
        )
        assert await paused.run_once() == 0
        dispatcher = OutboxDispatcher(
            db,
            {Topic.ANALYTICS_PUBLISH: handler},
            batch_size=1,
            max_attempts=1,
            only_topics=(Topic.ANALYTICS_PUBLISH,),
        )
        assert await dispatcher.run_once() == 1
        async with db.unit_of_work() as uow:
            out = (
                await uow.session.scalars(
                    select(OutboxEvent).where(OutboxEvent.topic == Topic.ANALYTICS_PUBLISH)
                )
            ).one()
            event_id = out.payload["event_id"]
            assert out.status == OutboxStatus.PENDING
            assert out.attempts == 1
            assert out.available_at > datetime.now(UTC)
            out.available_at = datetime.now(UTC) - timedelta(seconds=1)
        assert await dispatcher.run_once() == 1
        assert await dispatcher.run_once() == 0
        async with db.unit_of_work() as uow:
            out = (
                await uow.session.scalars(
                    select(OutboxEvent).where(OutboxEvent.topic == Topic.ANALYTICS_PUBLISH)
                )
            ).one()
            assert out.status == OutboxStatus.DONE
            assert out.payload["event_id"] == event_id
        assert publish.await_args_list[0] == publish.await_args_list[1]


async def test_grafana_role_safe_views_denied_raw_tables_and_writes(
    db: Database, tmp_path: Path
) -> None:
    await provision_grafana(db, tmp_path)
    await provision_grafana(db, tmp_path)
    async with db.unit_of_work() as uow:
        uow.ops.track(
            AnalyticsEvent.ANSWER_FEEDBACK,
            user_id=None,
            properties={"rating": "up", "comment": "private@example.test"},
        )
    async with db.raw_session() as session:
        await session.execute(text("SET LOCAL ROLE orbi_grafana"))
        rows = (
            (await session.execute(text("SELECT * FROM analytics_dashboard_events")))
            .mappings()
            .all()
        )
        assert rows[0]["rating"] == "up"
        assert "private" not in str(rows)
        assert "user_id" not in rows[0]
        assert (
            await session.execute(text("SELECT feedback_up FROM analytics_dashboard_summary"))
        ).scalar_one() == 1
    for statement in [
        "SELECT * FROM users",
        "SELECT * FROM analytics_events",
        "SELECT * FROM service_requests",
        "SELECT * FROM audit_log",
        "INSERT INTO analytics_events(name) VALUES ('test')",
        "DELETE FROM analytics_dashboard_events",
        "ALTER TABLE users ADD COLUMN bad text",
    ]:
        async with db.raw_session() as session:
            await session.execute(text("SET LOCAL ROLE orbi_grafana"))
            with pytest.raises(DBAPIError):
                await session.execute(text(statement))
    # Authenticate as the provisioned login too, rather than checking SET ROLE alone.
    url = make_url(build_settings().database_url).set(
        username="orbi_grafana", password=(tmp_path / "db_password").read_text()
    )
    engine = create_async_engine(url)
    try:
        async with engine.connect() as connection:
            assert (
                await connection.scalar(
                    text("SELECT questions_total FROM analytics_dashboard_summary")
                )
                == 0
            )
            with pytest.raises(DBAPIError):
                await connection.execute(text("SELECT * FROM users"))
    finally:
        await engine.dispose()


async def test_grafana_summary_matches_api_sources(db: Database) -> None:
    async with db.unit_of_work() as uow:
        for _ in range(3):
            uow.ops.track(AnalyticsEvent.KNOWLEDGE_SEARCH, user_id=None)
        uow.ops.track(AnalyticsEvent.ANSWER_FEEDBACK, user_id=None, properties={"rating": "up"})
        uow.ops.track(AnalyticsEvent.ANSWER_FEEDBACK, user_id=None, properties={"rating": "down"})
    async with db.unit_of_work() as uow:
        summary = await AnalyticsService(uow).summary()
        row = (
            (await uow.session.execute(text("SELECT * FROM analytics_dashboard_summary")))
            .mappings()
            .one()
        )
        for field in row:
            value = row[field]
            actual = getattr(summary, field)
            assert (float(value) if value is not None else None) == actual


async def test_backlog_query_counts_waiting_failed_and_ignores_done(db: Database) -> None:
    now = datetime.now(UTC)
    async with db.unit_of_work() as uow:
        for status in OutboxStatus:
            uow.session.add(
                OutboxEvent(
                    topic=Topic.ANALYTICS_PUBLISH,
                    payload={},
                    status=status,
                    created_at=now - timedelta(minutes=10),
                    available_at=now + timedelta(hours=1),
                )
            )
    async with db.unit_of_work() as uow:
        rows = await uow.outbox.backlog()
        rows = [row for row in rows if row[0] == Topic.ANALYTICS_PUBLISH]
        assert {status for _, status, _, _ in rows} == {OutboxStatus.PENDING, OutboxStatus.DEAD}
        assert all(count == 1 for _, _, count, _ in rows)


async def test_all_provisioned_dashboard_sql_executes_as_grafana(db: Database) -> None:
    dashboard = Path(__file__).parents[3] / "deploy/observability/grafana/dashboards/product.json"
    panels = json.loads(dashboard.read_text(encoding="utf-8"))["panels"]
    async with db.raw_session() as session:
        await session.execute(text("SET LOCAL ROLE orbi_grafana"))
        for panel in panels:
            for target in panel.get("targets", []):
                sql = target["rawSql"].replace(
                    "$__timeFilter(created_at)",
                    "created_at BETWEEN now() - interval '30 days' AND now()",
                )
                await session.execute(text(sql))
