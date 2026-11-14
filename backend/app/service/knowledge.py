import logging
from dataclasses import dataclass
from datetime import date
from uuid import UUID

from app.db.models import KbChunk, KbConflict, KbDocument
from app.db.repositories.knowledge import ChunkRow, Viewer
from app.db.uow import UnitOfWork
from app.domain.events import AnalyticsEvent, Topic
from app.domain.knowledge import (
    ConflictStatus,
    ConflictView,
    DocKind,
    DocScope,
    DocumentNotFoundError,
    SearchResult,
    doc_visible,
    reciprocal_rank_fusion,
    split_sections,
)
from app.domain.users import CurrentUser
from app.service.mappers import to_hit
from app.service.ports import Embeddings, TextGenerator

logger = logging.getLogger(__name__)

CANDIDATES = 20
EMBED_BATCH = 64


@dataclass(frozen=True, slots=True)
class DocumentView:
    slug: str
    title: str
    kind: DocKind
    scope: DocScope
    team_name: str | None
    owner: str
    source_label: str
    source_url: str | None
    updated_at: date
    body: str


def viewer_of(actor: CurrentUser) -> Viewer:
    return Viewer(role=actor.role, team_id=actor.team_id)


class KnowledgeService:
    def __init__(self, uow: UnitOfWork, embeddings: Embeddings | None) -> None:
        self._uow = uow
        self._embeddings = embeddings

    async def search(
        self, viewer: Viewer, query: str, *, limit: int = 5, user_id: UUID | None = None
    ) -> SearchResult:
        """Hybrid search: ACL filter in SQL, full-text and vector candidates, fused with RRF."""
        rankings = [await self._uow.knowledge.full_text(query, viewer, limit=CANDIDATES)]
        mode = "fts"
        if self._embeddings is not None:
            try:
                vector = await self._embeddings.embed_query(query)
                rankings.append(await self._uow.knowledge.nearest(vector, viewer, limit=CANDIDATES))
                mode = "hybrid"
            except Exception:  # embeddings are an enhancement; full-text still answers
                logger.warning("embedding the query failed, full-text only", exc_info=True)
        scores = reciprocal_rank_fusion(rankings)
        top = sorted(scores, key=lambda chunk_id: (-scores[chunk_id], str(chunk_id)))[:limit]
        rows = await self._uow.knowledge.chunk_rows(top)
        hits = [to_hit(rows[chunk_id], scores[chunk_id]) for chunk_id in top if chunk_id in rows]
        conflicts = await self._conflicts(viewer, [h.chunk_id for h in hits])
        self._uow.ops.track(
            AnalyticsEvent.KNOWLEDGE_SEARCH,
            user_id=user_id,
            properties={"hits": len(hits), "conflicts": len(conflicts), "mode": mode},
        )
        return SearchResult(query=query, hits=hits, conflicts=conflicts, mode=mode)

    async def document(self, viewer: Viewer, slug: str) -> DocumentView:
        document = await self._uow.knowledge.visible_document(slug, viewer)
        if document is None:
            raise DocumentNotFoundError()
        team = await self._uow.people.team(document.team_id)
        return DocumentView(
            slug=document.slug,
            title=document.title,
            kind=document.kind,
            scope=document.scope,
            team_name=team.name if team else None,
            owner=document.owner,
            source_label=document.source_label,
            source_url=document.source_url,
            updated_at=document.doc_updated_at,
            body=document.body,
        )

    async def ingest(
        self,
        *,
        slug: str,
        title: str,
        kind: DocKind,
        scope: DocScope,
        team_id: UUID | None,
        roles: list[str],
        owner: str,
        source_label: str,
        source_url: str | None,
        updated_at: date,
        body: str,
    ) -> KbDocument:
        """Create or replace a document and its sections; embeddings follow via the outbox."""
        document = await self._uow.knowledge.document_by_slug(slug)
        if document is None:
            document = KbDocument(slug=slug)
            self._uow.knowledge.add_document(document)
        document.title = title
        document.kind = kind
        document.scope = scope
        document.team_id = team_id
        document.roles = roles
        document.owner = owner
        document.source_label = source_label
        document.source_url = source_url
        document.doc_updated_at = updated_at
        document.body = body
        await self._uow.flush()
        await self._uow.knowledge.delete_chunks(document.id)
        for position, section in enumerate(split_sections(body, title=title)):
            self._uow.knowledge.add_chunk(
                KbChunk(
                    document_id=document.id,
                    position=position,
                    heading=section.heading,
                    content=section.content,
                    topic=section.topic,
                )
            )
        await self._uow.flush()
        self._uow.outbox.add(Topic.KB_EMBED, {"document_id": str(document.id)})
        return document

    async def embed_pending(self, *, limit: int = EMBED_BATCH) -> int:
        """Fill missing embeddings in batches; a no-op without an embeddings provider."""
        if self._embeddings is None:
            return 0
        chunks = await self._uow.knowledge.chunks_without_embedding(limit=limit)
        if not chunks:
            return 0
        vectors = await self._embeddings.embed_documents(
            [f"{c.heading}\n{c.content}" for c in chunks]
        )
        for chunk, vector in zip(chunks, vectors, strict=True):
            await self._uow.knowledge.set_embedding(chunk.id, vector)
        return len(chunks)

    async def register_conflict(
        self,
        *,
        topic: str,
        summary: str,
        team_document: str | None = None,
        detected_by: str = "owner",
    ) -> KbConflict | None:
        """Pair the company section with team sections on a topic as a known contradiction."""
        rows = await self._uow.knowledge.chunks_by_topic(topic)
        company = next((r for r in rows if r.document.scope is DocScope.COMPANY), None)
        teams = [
            r
            for r in rows
            if r.document.scope is DocScope.TEAM
            and (team_document is None or r.document.slug == team_document)
        ]
        if company is None or not teams:
            return None
        created: KbConflict | None = None
        for team in teams:
            conflict = KbConflict(
                topic=topic,
                company_chunk_id=company.chunk.id,
                team_chunk_id=team.chunk.id,
                summary=summary,
                detected_by=detected_by,
            )
            self._uow.knowledge.add_conflict(conflict)
            created = conflict
        await self._uow.flush()
        return created

    async def detect_conflicts(self, generator: TextGenerator, topics: list[str]) -> int:
        """Ask the heavy model whether company and team rules on a topic contradict each other."""
        found = 0
        for topic in topics:
            rows = await self._uow.knowledge.chunks_by_topic(topic)
            company = [r for r in rows if r.document.scope is DocScope.COMPANY]
            teams = [r for r in rows if r.document.scope is DocScope.TEAM]
            if not company or not teams:
                continue
            existing = await self._uow.knowledge.conflicts_touching([company[0].chunk.id])
            if existing:
                continue
            verdict = await generator.generate(
                "Ты проверяешь базу знаний. Ответь строго в формате: первая строка ДА или НЕТ "
                "(противоречат ли правила), вторая строка — одно предложение, в чём расхождение.",
                f"Общее правило компании:\n{company[0].chunk.content}\n\n"
                f"Правило команды:\n{teams[0].chunk.content}",
            )
            if verdict and verdict.upper().startswith("ДА"):
                summary = verdict.split("\n", 1)[1].strip() if "\n" in verdict else verdict
                await self.register_conflict(
                    topic=topic,
                    summary=summary,
                    team_document=teams[0].document.slug,
                    detected_by="llm",
                )
                found += 1
        return found

    async def _conflicts(self, viewer: Viewer, chunk_ids: list[UUID]) -> list[ConflictView]:
        conflicts = await self._uow.knowledge.conflicts_touching(chunk_ids)
        if not conflicts:
            return []
        rows = await self._uow.knowledge.chunk_rows(
            [c.company_chunk_id for c in conflicts] + [c.team_chunk_id for c in conflicts]
        )
        views: list[ConflictView] = []
        for conflict in conflicts:
            if conflict.status is ConflictStatus.RESOLVED:
                continue
            company = rows.get(conflict.company_chunk_id)
            team = rows.get(conflict.team_chunk_id)
            # Both sides must be visible, or showing the pair would leak the hidden one.
            if (
                company is None
                or team is None
                or not (_visible(company, viewer) and _visible(team, viewer))
            ):
                continue
            views.append(
                ConflictView(
                    id=conflict.id,
                    topic=conflict.topic,
                    summary=conflict.summary,
                    status=conflict.status,
                    company=to_hit(company, 0.0),
                    team=to_hit(team, 0.0),
                )
            )
        return views


def _visible(row: ChunkRow, viewer: Viewer) -> bool:
    return doc_visible(
        scope=row.document.scope,
        team_id=row.document.team_id,
        roles=row.document.roles,
        viewer_role=viewer.role,
        viewer_team_id=viewer.team_id,
    )
