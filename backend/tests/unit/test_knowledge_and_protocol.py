import json
from datetime import date
from uuid import uuid4

import pytest

from app.core.security import webhooks
from app.db.repositories.knowledge import or_query
from app.domain.knowledge import (
    DocScope,
    coverage,
    detect_sensitive,
    doc_visible,
    reciprocal_rank_fusion,
    split_sections,
)
from app.domain.users import Role
from app.service.assistant import stream

TEAM = uuid4()


def test_sections_split_by_heading_and_carry_topics() -> None:
    body = "Вступление.\n\n## Правила\n<!-- topic: code_review.rules -->\nPR в main.\n\n## Пусто\n"
    sections = split_sections(body, title="Регламент")

    assert [(s.heading, s.topic) for s in sections] == [
        ("Регламент", None),
        ("Правила", "code_review.rules"),
    ]
    assert "topic" not in sections[1].content


def test_rrf_rewards_agreement_between_rankings() -> None:
    a, b, c = uuid4(), uuid4(), uuid4()
    scores = reciprocal_rank_fusion([[a, b], [b, c]])

    assert max(scores, key=lambda key: scores[key]) == b
    assert set(scores) == {a, b, c}


def test_document_visibility_by_scope_team_and_role() -> None:
    kwargs = {"viewer_role": Role.INTERN, "viewer_team_id": TEAM}
    assert doc_visible(scope=DocScope.COMPANY, team_id=None, roles=[], **kwargs)  # type: ignore[arg-type]
    assert doc_visible(scope=DocScope.TEAM, team_id=TEAM, roles=[], **kwargs)  # type: ignore[arg-type]
    assert not doc_visible(scope=DocScope.TEAM, team_id=uuid4(), roles=[], **kwargs)  # type: ignore[arg-type]
    assert not doc_visible(scope=DocScope.COMPANY, team_id=None, roles=["mentor"], **kwargs)  # type: ignore[arg-type]
    assert doc_visible(
        scope=DocScope.TEAM,
        team_id=uuid4(),
        roles=["mentor"],
        viewer_role=Role.ADMIN,
        viewer_team_id=None,
    )


@pytest.mark.parametrize(
    ("text", "topic"),
    [
        ("Сколько зарплата у Ивана?", "compensation"),
        ("У меня конфликт с наставником", "conflict"),
        ("Как получить доступ к Jira?", None),
    ],
)
def test_sensitive_topics(text: str, topic: str | None) -> None:
    assert detect_sensitive(text) == topic


def test_query_coverage_ignores_stop_words() -> None:
    assert coverage("Куда отправить PR?", "PR отправляют в ветку develop") == 1.0
    assert coverage("как мне", "что угодно") == 0.0
    assert or_query("Как скачать репозиторий?") == "как | скачать | репозиторий"
    assert or_query("?!") is None


def test_webhook_signature_and_replay_window() -> None:
    body = b'{"x": 1}'
    signature = webhooks.sign("secret", "1000", body)

    assert webhooks.verify(
        "secret", timestamp="1000", signature=signature, body=body, now=1100, tolerance_sec=300
    )
    assert not webhooks.verify(
        "other", timestamp="1000", signature=signature, body=body, now=1100, tolerance_sec=300
    )
    assert not webhooks.verify(
        "secret", timestamp="1000", signature=signature, body=body, now=9999, tolerance_sec=300
    )
    assert not webhooks.verify(
        "secret", timestamp="abc", signature=signature, body=body, now=1000, tolerance_sec=300
    )
    assert not webhooks.verify(
        "secret", timestamp=None, signature=None, body=body, now=1000, tolerance_sec=300
    )


def test_stream_chunks_follow_the_ai_sdk_protocol() -> None:
    def parse(chunk: str) -> dict[str, object]:
        assert chunk.startswith("data: ")
        assert chunk.endswith("\n\n")
        parsed: dict[str, object] = json.loads(chunk[6:])
        return parsed

    assert parse(stream.start("m1", {"mode": "offline"}))["messageMetadata"] == {"mode": "offline"}
    assert parse(stream.text_delta("t1", "привет"))["delta"] == "привет"
    assert parse(stream.data("sources", {"n": 1}))["type"] == "data-sources"
    assert parse(stream.status("Думаю", mode="offline"))["transient"] is True
    assert parse(stream.error("упс"))["errorText"] == "упс"
    assert parse(stream.tool_input("c1", "search", {"q": 1}))["toolName"] == "search"
    assert parse(stream.tool_output("c1", {"ok": True}))["output"] == {"ok": True}
    assert parse(stream.finish())["type"] == "finish"
    assert parse(stream.text_start("t"))["type"] == "text-start"
    assert parse(stream.text_end("t"))["type"] == "text-end"
    assert stream.DONE == "data: [DONE]\n\n"
    assert date.today()
