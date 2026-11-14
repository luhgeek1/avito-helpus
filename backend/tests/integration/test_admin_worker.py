import asyncio
import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from httpx import AsyncClient
from redis.asyncio import Redis
from sqlalchemy import func, select

from app.cli import generate_keys
from app.core.config import Settings
from app.db.database import Database
from app.db.models import KbConflict, Notification
from app.domain.corp import EquipmentStatus
from app.domain.users import Role
from app.infra.bus import RedisPublisher, subscribe
from app.seed.loader import seed
from app.service.knowledge import KnowledgeService
from app.service.nudges import Nudges, ScheduledJob, run_due
from app.worker import maintenance_jobs
from tests.fakes import FakeCorpServices, FakeEmbeddings, FakeGenerator, RecordingPublisher, laptop
from tests.integration.conftest import ANYA, Account


async def test_flags_audit_and_metrics(
    client: AsyncClient, admin: Account, maria: Account, anya: Account
) -> None:
    flags = (await client.get("/api/v1/admin/flags", headers=admin.headers)).json()
    updated = await client.put(
        "/api/v1/admin/flags/proactive_nudges",
        json={"enabled": True, "rollout_percent": 50, "variants": ["a", "b"]},
        headers=admin.headers,
    )
    missing = await client.put(
        "/api/v1/admin/flags/nope",
        json={"enabled": True, "rollout_percent": 1},
        headers=admin.headers,
    )
    forbidden = await client.get("/api/v1/admin/flags", headers=anya.headers)
    audit = (await client.get("/api/v1/admin/audit", headers=admin.headers)).json()
    summary = await client.get("/api/v1/analytics/summary", headers=maria.headers)
    ui = await client.post(
        "/api/v1/analytics/events", json={"name": "plan.opened"}, headers=anya.headers
    )

    assert {f["key"] for f in flags} >= {"orbi_assistant", "proactive_nudges"}
    assert updated.json()["rollout_percent"] == 50
    assert missing.status_code == 404
    assert forbidden.status_code == 403
    assert audit[0]["action"] == "flag.changed"
    assert summary.json()["period_days"] == 30
    assert summary.json()["plan_on_time_share"] is not None
    assert ui.status_code == 204
    assert (await client.get("/api/v1/analytics/summary", headers=anya.headers)).status_code == 403


async def test_demo_reset(
    client: AsyncClient, admin: Account, anya: Account, corp: FakeCorpServices
) -> None:
    await client.post(
        "/api/v1/escalations", json={"question": "Вопрос до сброса"}, headers=anya.headers
    )

    reset = await client.post("/api/v1/admin/demo/reset", headers=admin.headers)

    assert reset.status_code == 202
    assert "reset_demo" in corp.calls
    # Old tokens die with the old accounts.
    assert (await client.get("/api/v1/me", headers=anya.headers)).status_code == 401


async def test_seed_is_idempotent(db: Database) -> None:
    assert await seed(db) == {}


async def test_flag_variant_length_is_validated(client: AsyncClient, admin: Account) -> None:
    response = await client.put(
        "/api/v1/admin/flags/proactive_nudges",
        headers=admin.headers,
        json={"enabled": True, "rollout_percent": 50, "variants": ["x" * 33]},
    )
    assert response.status_code == 422
    assert response.json()["error_code"] == "REQUEST_VALIDATION_ERROR"


async def test_notifications(client: AsyncClient, anya: Account) -> None:
    await client.post(
        "/api/v1/escalations", json={"question": "Вопрос для уведомлений"}, headers=anya.headers
    )
    ivan_token = (
        await client.post(
            "/api/v1/auth/login",
            json={"email": "ivan.mentor@buddy.test", "password": "orbi-demo-2026"},
            headers={"X-Client": "mobile"},
        )
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {ivan_token}"}

    inbox = (await client.get("/api/v1/notifications?unread_only=true", headers=headers)).json()
    one = await client.post(
        f"/api/v1/notifications/{inbox['items'][0]['id']}/read", headers=headers
    )
    unknown = await client.post(
        "/api/v1/notifications/00000000-0000-0000-0000-000000000000/read", headers=headers
    )
    await client.post("/api/v1/notifications/read-all", headers=headers)

    assert inbox["unread"] >= 1
    assert one.status_code == 204
    assert unknown.status_code == 404
    assert (await client.get("/api/v1/notifications", headers=headers)).json()["unread"] == 0


async def test_realtime_publish_and_subscribe(settings: Settings) -> None:
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    received: list[dict[str, object]] = []

    async def listen() -> None:
        async for message in subscribe(redis, "user-1"):
            received.append(message)
            return

    task = asyncio.create_task(listen())
    await asyncio.sleep(0.2)
    await RedisPublisher(redis).publish("user-1", "plan.updated", {"x": 1})
    await asyncio.wait_for(task, timeout=3)
    await redis.aclose()

    assert received == [{"event": "plan.updated", "data": {"x": 1}}]


async def test_outbox_delivers_realtime_events(
    client: AsyncClient, anya: Account, run_outbox: object, publisher: RecordingPublisher
) -> None:
    await client.post(
        "/api/v1/escalations", json={"question": "Есть кто живой?"}, headers=anya.headers
    )

    await run_outbox()  # type: ignore[operator]

    assert any(event == "notification.created" for _, event, _ in publisher.events)


async def test_ai_cron_jobs(
    client: AsyncClient, db: Database, corp: FakeCorpServices, settings: Settings, anya: Account
) -> None:
    corp.equipment_items[ANYA] = [laptop(EquipmentStatus.READY_FOR_PICKUP)]
    nudges = Nudges(db, corp, settings, generator=FakeGenerator("Сводка от модели"))

    overdue = await nudges.overdue_steps()
    overdue_again = await nudges.overdue_steps()
    ready = await nudges.equipment_ready()
    digests = await nudges.mentor_digests()
    sla = await nudges.requests_past_sla()
    escalated = await nudges.escalate()

    assert overdue >= 1  # Kirill's second-week steps are past due
    assert overdue_again == 0  # one nudge per step per day
    assert ready == 1
    assert digests == 2
    assert sla == 0
    assert escalated == 0
    async with db.unit_of_work() as uow:
        bodies = (
            await uow.session.scalars(
                select(Notification.body).where(Notification.kind == "digest")
            )
        ).all()
    assert "Сводка от модели" in bodies


async def test_digest_template_without_a_model(
    db: Database, corp: FakeCorpServices, settings: Settings
) -> None:
    async with db.unit_of_work() as uow:
        ivan = await uow.people.get_by_email("ivan.mentor@buddy.test")
        assert ivan is not None
        text = await Nudges(db, corp, settings).digest_text(uow, ivan.id, Role.MENTOR)

    assert "Кирилл Орлов" in text
    assert "блокеров 1" in text


async def test_scheduler_runs_due_jobs_and_survives_failures() -> None:
    calls: list[str] = []

    async def ok() -> int:
        calls.append("ok")
        return 1

    async def broken() -> int:
        raise RuntimeError("boom")

    jobs = [
        ScheduledJob("ok", timedelta(minutes=1), ok),
        ScheduledJob("broken", timedelta(minutes=1), broken),
    ]
    next_runs: dict[str, datetime] = {}
    now = datetime.now(UTC)

    await run_due(jobs, next_runs, now)
    await run_due(jobs, next_runs, now + timedelta(seconds=10))
    await run_due(jobs, next_runs, now + timedelta(minutes=2))

    assert calls == ["ok", "ok"]


async def test_maintenance_jobs(db: Database, settings: Settings) -> None:
    jobs = {job.name: job for job in maintenance_jobs(db, settings)}

    assert await jobs["sessions-cleanup"].run() == 0
    assert await jobs["embed-backfill"].run() == 0  # offline settings: no embeddings provider
    assert await jobs["conflict-check"].run() == 0


async def test_llm_conflict_detection(db: Database) -> None:
    async with db.unit_of_work() as uow:
        before = await uow.session.scalar(select(func.count()).select_from(KbConflict))
        found = await KnowledgeService(uow, FakeEmbeddings()).detect_conflicts(
            FakeGenerator("ДА\nВ общем регламенте сроки другие"),
            ["access.process", "code_review.rules"],
        )
        after = await uow.session.scalar(select(func.count()).select_from(KbConflict))

    assert found == 0  # access.process has no team version; code_review.rules is already known
    assert before == after


def test_generate_keys_once(tmp_path: Path) -> None:
    assert "generated" in generate_keys(tmp_path)
    assert "already exist" in generate_keys(tmp_path)
    if os.name == "posix":
        assert (tmp_path / "jwt_private_key.pem").stat().st_mode & 0o777 == 0o600
    # On Windows verify the usable pair and preservation; NTFS has no POSIX permission bits.
    private_bytes = (tmp_path / "jwt_private_key.pem").read_bytes()
    private = serialization.load_pem_private_key(private_bytes, password=None)
    public = serialization.load_pem_public_key((tmp_path / "jwt_public_key.pem").read_bytes())
    assert private.public_key().public_numbers() == public.public_numbers()
    generate_keys(tmp_path)
    assert (tmp_path / "jwt_private_key.pem").read_bytes() == private_bytes
