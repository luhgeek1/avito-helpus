"""Operator-only Markdown import; no browser API or model tool can write knowledge."""

from datetime import date
from pathlib import Path
from typing import Self
from uuid import UUID

import yaml
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

from app.db.database import Database
from app.domain.knowledge import SYNTHETIC_LABEL, DocKind, DocScope
from app.domain.users import Role
from app.service.knowledge import KnowledgeService

MAX_DOCUMENT_BYTES = 1_000_000
MAX_DOCUMENTS = 100


class KnowledgeFile(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=100)
    title: str = Field(min_length=1, max_length=300)
    kind: DocKind = DocKind.GUIDE
    scope: DocScope
    team_id: UUID | None = None
    roles: list[Role] = Field(min_length=1)
    owner: str = Field(min_length=1, max_length=200)
    updated_at: date
    source_url: HttpUrl | None = None
    body: str = Field(min_length=1, max_length=MAX_DOCUMENT_BYTES)

    @model_validator(mode="after")
    def scope_matches_team(self) -> Self:
        if (self.scope is DocScope.TEAM) != (self.team_id is not None):
            raise ValueError("team scope requires team_id; company scope forbids team_id")
        return self


def read_knowledge(directory: Path) -> list[KnowledgeFile]:
    if not directory.is_dir():
        raise ValueError(f"Not a directory: {directory}")
    paths = sorted(directory.glob("*.md"))
    if not paths or len(paths) > MAX_DOCUMENTS:
        raise ValueError(f"Expected 1 to {MAX_DOCUMENTS} Markdown files")
    result = []
    slugs: set[str] = set()
    for path in paths:
        if path.is_symlink() or path.stat().st_size > MAX_DOCUMENT_BYTES:
            raise ValueError(f"Not a regular bounded document: {path.name}")
        text = path.read_text(encoding="utf-8")
        if not text.startswith("---\n") or "\n---\n" not in text[4:]:
            raise ValueError(f"Missing YAML front matter: {path.name}")
        header, body = text[4:].split("\n---\n", 1)
        metadata = yaml.safe_load(header)
        if not isinstance(metadata, dict) or "body" in metadata:
            raise ValueError(f"Invalid document metadata: {path.name}")
        document = KnowledgeFile.model_validate({**metadata, "body": body})
        if document.slug in slugs:
            raise ValueError(f"Duplicate slug: {document.slug}")
        slugs.add(document.slug)
        result.append(document)
    return result


async def import_knowledge(
    db: Database, documents: list[KnowledgeFile], *, replace: bool = False
) -> int:
    """One transaction for the batch. A failure preserves all existing documents."""
    async with db.unit_of_work() as uow:
        service = KnowledgeService(uow, embeddings=None)
        for document in documents:
            if document.team_id and await uow.people.team(document.team_id) is None:
                raise ValueError(f"Unknown team_id for {document.slug}")
            if not replace and await uow.knowledge.document_by_slug(document.slug) is not None:
                raise ValueError(f"Document exists: {document.slug}; pass --replace to update")
            await service.ingest(
                slug=document.slug,
                title=document.title,
                kind=document.kind,
                scope=document.scope,
                team_id=document.team_id,
                roles=[role.value for role in document.roles],
                owner=document.owner,
                source_label=SYNTHETIC_LABEL,
                source_url=str(document.source_url) if document.source_url else None,
                updated_at=document.updated_at,
                body=document.body,
            )
    return len(documents)
