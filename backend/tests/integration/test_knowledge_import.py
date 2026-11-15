from datetime import date
from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.db.database import Database
from app.domain.knowledge import SYNTHETIC_LABEL, DocScope
from app.knowledge_import import KnowledgeFile, import_knowledge
from tests.integration.conftest import Account


def document(slug: str = "sdk-private") -> KnowledgeFile:
    return KnowledgeFile(
        slug=slug,
        title="Installation knowledge",
        scope=DocScope.COMPANY,
        roles=["mentor"],
        owner="Synthetic owner",
        updated_at=date(2026, 11, 15),
        source_url="https://example.test/guide",
        body="## Installation\nSynthetic SDK knowledge.",
    )


async def test_import_respects_acl_and_replaces_only_explicitly(
    db: Database,
    client: AsyncClient,
    anya: Account,
    ivan: Account,
) -> None:
    doc = document()
    assert await import_knowledge(db, [doc]) == 1
    hidden = await client.get("/api/v1/knowledge/documents/sdk-private", headers=anya.headers)
    assert hidden.status_code == 404
    visible = await client.get("/api/v1/knowledge/documents/sdk-private", headers=ivan.headers)
    assert visible.status_code == 200
    assert visible.json()["source_label"] == SYNTHETIC_LABEL
    with pytest.raises(ValueError, match="exists"):
        await import_knowledge(db, [doc])
    changed = doc.model_copy(update={"body": "## Updated\nNew synthetic knowledge."})
    assert await import_knowledge(db, [changed], replace=True) == 1
    async with db.unit_of_work() as uow:
        saved = await uow.knowledge.document_by_slug(doc.slug)
        assert saved is not None
        assert saved.body == changed.body


async def test_batch_rolls_back_on_unknown_team(db: Database) -> None:
    bad = document("sdk-invalid").model_copy(update={"scope": DocScope.TEAM, "team_id": uuid4()})
    with pytest.raises(ValueError, match="Unknown team"):
        await import_knowledge(db, [document("sdk-atomic"), bad])
    async with db.unit_of_work() as uow:
        assert await uow.knowledge.document_by_slug("sdk-atomic") is None
