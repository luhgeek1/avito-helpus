from datetime import timedelta

import pytest
from httpx import AsyncClient

from app.core.clock import utcnow
from app.core.config import Settings
from app.db.database import Database
from app.service.escalations import EscalationService
from app.service.knowledge import KnowledgeService
from tests.fakes import FakeEmbeddings
from tests.integration.conftest import ANYA, Account, AppFactory, login


async def _search(client: AsyncClient, account: Account, q: str) -> dict[str, object]:
    response = await client.get(
        "/api/v1/knowledge/search", params={"q": q}, headers=account.headers
    )
    assert response.status_code == 200, response.text
    result: dict[str, object] = response.json()
    return result


async def test_search_finds_team_rules_and_the_conflict(client: AsyncClient, anya: Account) -> None:
    result = await _search(client, anya, "Куда отправить PR и кого позвать на ревью?")

    titles = {s["document_title"] for s in result["sources"]}  # type: ignore[attr-defined]
    assert "Команда «Объявления»: как мы работаем" in titles
    assert result["mode"] == "fts"
    conflicts = result["conflicts"]
    assert len(conflicts) == 1  # type: ignore[arg-type]
    assert conflicts[0]["topic"] == "code_review.rules"  # type: ignore[index]


async def test_other_teams_and_roles_stay_hidden(
    client: AsyncClient, anya: Account, dana: Account, ivan: Account
) -> None:
    dana_hits = await _search(client, dana, "ревью PR develop техлид listings-reviewers")
    anya_hits = await _search(client, anya, "методичка наставника нагрузка")
    ivan_hits = await _search(client, ivan, "методичка наставника нагрузка")

    assert all(s["team_name"] != "Объявления: Backend" for s in dana_hits["sources"])  # type: ignore[attr-defined]
    assert all(s["document_slug"] != "mentor-guide" for s in anya_hits["sources"])  # type: ignore[attr-defined]
    assert any(s["document_slug"] == "mentor-guide" for s in ivan_hits["sources"])  # type: ignore[attr-defined]
    hidden = await client.get("/api/v1/knowledge/documents/mentor-guide", headers=anya.headers)
    visible = await client.get("/api/v1/knowledge/documents/access-policy", headers=anya.headers)
    assert hidden.status_code == 404
    assert visible.json()["source_label"] == "Тестовая инструкция, не регламент Авито"


async def test_reporting_a_conflict_asks_the_mentor(
    client: AsyncClient, anya: Account, ivan: Account
) -> None:
    result = await _search(client, anya, "Как называть ветки?")
    conflict = result["conflicts"][0]  # type: ignore[index]

    response = await client.post(
        f"/api/v1/knowledge/conflicts/{conflict['id']}/report", json={}, headers=anya.headers
    )

    assert response.status_code == 201
    assert response.json()["kind"] == "conflict"
    assert response.json()["assignee_name"] == "Иван Петров"
    assigned = (await client.get("/api/v1/escalations?scope=assigned", headers=ivan.headers)).json()
    assert any(e["kind"] == "conflict" for e in assigned)


@pytest.mark.parametrize("embeddings", [FakeEmbeddings()])
async def test_hybrid_search_with_embeddings(
    client: AsyncClient, anya: Account, db: Database, embeddings: FakeEmbeddings
) -> None:
    async with db.unit_of_work() as uow:
        filled = await KnowledgeService(uow, embeddings).embed_pending(limit=500)
    result = await _search(client, anya, "Как получить доступ к репозиторию?")

    assert filled > 50
    assert result["mode"] == "hybrid"
    assert result["sources"]


async def test_failed_embeddings_fall_back_to_full_text(app_factory: AppFactory) -> None:
    async with app_factory(embeddings=FakeEmbeddings(fail=True)) as (_, client):
        anya = await login(client, ANYA)
        result = await _search(client, anya, "Как получить доступ к репозиторию?")

    assert result["mode"] == "fts"
    assert result["sources"]


async def test_question_answer_and_faq(
    client: AsyncClient, anya: Account, ivan: Account, kirill: Account
) -> None:
    asked = await client.post(
        "/api/v1/escalations",
        json={"question": "Где взять тестовые данные для стейджинга?"},
        headers=anya.headers,
    )
    escalation = asked.json()
    assert escalation["assignee_name"] == "Иван Петров"

    stranger = await client.post(
        f"/api/v1/escalations/{escalation['id']}/answer",
        json={"answer": "x" * 10},
        headers=kirill.headers,
    )
    assert stranger.status_code == 403

    answered = await client.post(
        f"/api/v1/escalations/{escalation['id']}/answer",
        json={
            "answer": "Тестовые данные — в бакете listings-fixtures, генератор: make fixtures.",
            "publish_to_faq": True,
        },
        headers=ivan.headers,
    )
    assert answered.json()["status"] == "answered"
    assert answered.json()["faq_document_slug"].startswith("faq-")

    mine = (await client.get("/api/v1/escalations", headers=anya.headers)).json()
    assert mine[0]["answer"].startswith("Тестовые данные")
    found = await _search(client, kirill, "тестовые данные стейджинг fixtures")
    assert any(s["document_slug"].startswith("faq-") for s in found["sources"])  # type: ignore[attr-defined]

    one = await client.get(f"/api/v1/escalations/{escalation['id']}", headers=anya.headers)
    assert one.json()["faq_document_slug"] == answered.json()["faq_document_slug"]
    twice = await client.post(
        f"/api/v1/escalations/{escalation['id']}/answer",
        json={"answer": "ещё раз"},
        headers=ivan.headers,
    )
    assert twice.json()["error_code"] == "ESCALATION_CLOSED"
    closed = await client.post(
        f"/api/v1/escalations/{escalation['id']}/close", headers=anya.headers
    )
    assert closed.json()["status"] == "closed"


async def test_sensitive_questions_go_to_hrbp(
    client: AsyncClient, anya: Account, olga: Account
) -> None:
    response = await client.post(
        "/api/v1/escalations",
        json={"question": "Хочу обсудить конфликт в команде", "kind": "sensitive"},
        headers=anya.headers,
    )

    assert response.json()["level"] == "hrbp"
    assigned = (await client.get("/api/v1/escalations?scope=assigned", headers=olga.headers)).json()
    assert assigned[0]["kind"] == "sensitive"


async def test_ladder_moves_unanswered_questions_up(
    client: AsyncClient, kirill: Account, db: Database, settings: Settings
) -> None:
    service_now = utcnow() + timedelta(hours=25)
    async with db.unit_of_work() as uow:
        moved = await EscalationService(uow, sla_hours=24).escalate_overdue(service_now)
    async with db.unit_of_work() as uow:
        moved_again = await EscalationService(uow, sla_hours=24).escalate_overdue(
            service_now + timedelta(hours=25)
        )

    question = (await client.get("/api/v1/escalations", headers=kirill.headers)).json()[0]
    assert moved == 1
    assert moved_again == 1
    assert question["level"] == "hrbp"
    assert settings.escalation_sla_hours == 24


async def test_mentor_views_follow_abac(
    client: AsyncClient, ivan: Account, maria: Account, olga: Account, anya: Account
) -> None:
    pavel = await login(client, "pavel.mentor@buddy.test")
    ivan_view = (await client.get("/api/v1/mentees", headers=ivan.headers)).json()
    maria_view = (await client.get("/api/v1/mentees", headers=maria.headers)).json()
    olga_view = (await client.get("/api/v1/mentees", headers=olga.headers)).json()

    assert {m["person"]["full_name"] for m in ivan_view} == {"Аня Смирнова", "Кирилл Орлов"}
    assert {m["person"]["full_name"] for m in maria_view} == {"Аня Смирнова", "Кирилл Орлов"}
    assert len(olga_view) == 3
    kirill_row = next(m for m in ivan_view if m["person"]["full_name"] == "Кирилл Орлов")
    assert kirill_row["needs_attention"] is True
    assert kirill_row["blocked"][0]["slug"] == "team-docs"
    assert kirill_row["awaiting_review"][0]["slug"] == "first-pr"

    detail = await client.get(f"/api/v1/mentees/{kirill_row['person']['id']}", headers=ivan.headers)
    assert detail.json()["requests"][0]["status"] == "approved"
    assert detail.json()["questions"][0]["status"] == "open"
    foreign = await client.get(
        f"/api/v1/mentees/{kirill_row['person']['id']}", headers=pavel.headers
    )
    assert foreign.status_code == 404
    intern = await client.get("/api/v1/mentees", headers=anya.headers)
    assert intern.status_code == 403
