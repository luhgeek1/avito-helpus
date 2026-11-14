from contextlib import asynccontextmanager
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.domain.corp import CorpUnavailableError
from app.domain.escalations import EscalationLevel
from app.service import nudges
from app.service.escalations import EscalationService
from app.service.nudges import Nudges
from tests.conftest import build_settings


@asynccontextmanager
async def yielding(value):
    yield value


def db_with(uow):
    return SimpleNamespace(unit_of_work=lambda: yielding(uow))


@pytest.mark.parametrize(
    "name",
    [
        "escalate",
        "reconcile",
        "overdue_steps",
        "requests_past_sla",
        "equipment_ready",
        "mentor_digests",
    ],
)
async def test_busy_scheduled_job_is_not_run_twice(
    name: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    lock = AsyncMock(return_value=False)
    monkeypatch.setattr(nudges, "_locked", lock)
    service = Nudges(db_with(object()), object(), build_settings())
    assert await getattr(service, name)() == 0
    lock.assert_awaited_once()


async def test_disabled_nudges_do_not_notify_overdue_items(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(nudges, "_locked", AsyncMock(return_value=True))
    uow = SimpleNamespace(
        plan=SimpleNamespace(
            overdue=AsyncMock(return_value=[(SimpleNamespace(user_id=uuid4()), object())])
        ),
        requests=SimpleNamespace(
            past_sla=AsyncMock(return_value=[SimpleNamespace(user_id=uuid4())])
        ),
    )
    service = Nudges(db_with(uow), object(), build_settings())
    monkeypatch.setattr(service, "_nudges_on", AsyncMock(return_value=False))
    assert await service.overdue_steps() == 0
    assert await service.requests_past_sla() == 0


async def test_equipment_outage_returns_partial_progress(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(nudges, "_locked", AsyncMock(return_value=True))
    uow = SimpleNamespace(
        people=SimpleNamespace(
            interns=AsyncMock(return_value=[SimpleNamespace(email="test@buddy.test")])
        )
    )
    corp = SimpleNamespace(equipment=AsyncMock(side_effect=CorpUnavailableError()))
    assert await Nudges(db_with(uow), corp, build_settings()).equipment_ready() == 0


async def test_reconcile_with_missing_external_id_skips_update(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(nudges, "_locked", AsyncMock(return_value=True))
    request = SimpleNamespace(external_id=None)
    uow = SimpleNamespace(
        requests=SimpleNamespace(awaiting_decision=AsyncMock(return_value=[request]))
    )
    assert await Nudges(db_with(uow), object(), build_settings()).reconcile() == 0


async def test_digest_skips_deleted_mentor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(nudges, "_locked", AsyncMock(return_value=True))
    uow = SimpleNamespace(
        people=SimpleNamespace(
            interns=AsyncMock(return_value=[SimpleNamespace(mentor_id=uuid4())]),
            get=AsyncMock(return_value=None),
        )
    )
    assert await Nudges(db_with(uow), object(), build_settings()).mentor_digests() == 0


async def test_escalation_cron_handles_deleted_asker_and_last_level() -> None:
    missing, last = (
        SimpleNamespace(user_id=uuid4()),
        SimpleNamespace(user_id=uuid4(), level=EscalationLevel.HRBP),
    )
    uow = SimpleNamespace(
        escalations=SimpleNamespace(overdue=AsyncMock(return_value=[missing, last])),
        people=SimpleNamespace(
            get=AsyncMock(
                side_effect=[None, SimpleNamespace(mentor_id=None, lead_id=None, hrbp_id=uuid4())]
            )
        ),
        flush=AsyncMock(),
    )
    assert await EscalationService(uow, sla_hours=24).escalate_overdue(datetime.now(UTC)) == 0
    uow.flush.assert_awaited_once()


async def test_reconcile_stops_cleanly_on_outage_and_issued_equipment_is_not_announced(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from app.domain.corp import EquipmentStatus  # noqa: PLC0415

    monkeypatch.setattr(nudges, "_locked", AsyncMock(return_value=True))
    monkeypatch.setattr(nudges, "reconcile_ticket", AsyncMock(side_effect=CorpUnavailableError()))
    uow = SimpleNamespace(
        requests=SimpleNamespace(awaiting_decision=AsyncMock(return_value=[object()])),
        people=SimpleNamespace(interns=AsyncMock(return_value=[SimpleNamespace(email="test")])),
    )
    corp = SimpleNamespace(
        equipment=AsyncMock(return_value=[SimpleNamespace(status=EquipmentStatus.ISSUED)])
    )
    service = Nudges(db_with(uow), corp, build_settings())
    assert await service.reconcile() == 0
    assert await service.equipment_ready() == 0
