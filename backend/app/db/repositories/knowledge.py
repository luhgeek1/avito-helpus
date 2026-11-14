import re
from collections.abc import Sequence
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import ColumnElement, and_, delete, func, literal, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import KbChunk, KbConflict, KbDocument, Team
from app.domain.knowledge import DocScope
from app.domain.users import Role

_WORD = re.compile(r"[0-9a-zа-яё]+", re.IGNORECASE)
_MIN_WORD = 3
_MIN_ACRONYM = 2
_MAX_WORDS = 12


@dataclass(frozen=True, slots=True)
class Viewer:
    role: Role
    team_id: UUID | None


@dataclass(frozen=True, slots=True)
class ChunkRow:
    chunk: KbChunk
    document: KbDocument
    team_name: str | None


def or_query(text: str) -> str | None:
    """Questions are long; OR over the meaningful words lets ranking (not AND) decide relevance."""
    # Latin acronyms (PR, CI, QA) are short but meaningful; short Russian words are mostly noise.
    words = [
        w.lower()
        for w in _WORD.findall(text)
        if len(w) >= _MIN_WORD or (len(w) >= _MIN_ACRONYM and w.isascii() and w.isalpha())
    ][:_MAX_WORDS]
    return " | ".join(dict.fromkeys(words)) if words else None


def _visible(viewer: Viewer) -> ColumnElement[bool]:
    # ACL is applied in SQL before ranking: hidden text never reaches the model or the client.
    if viewer.role is Role.ADMIN:
        return literal(True)
    role_ok = or_(
        func.cardinality(KbDocument.roles) == 0, KbDocument.roles.contains([viewer.role.value])
    )
    scope_ok = or_(
        KbDocument.scope == DocScope.COMPANY,
        and_(KbDocument.scope == DocScope.TEAM, KbDocument.team_id == viewer.team_id),
    )
    return and_(role_ok, scope_ok)


class KnowledgeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def add_document(self, document: KbDocument) -> None:
        self._session.add(document)

    def add_chunk(self, chunk: KbChunk) -> None:
        self._session.add(chunk)

    def add_conflict(self, conflict: KbConflict) -> None:
        self._session.add(conflict)

    async def document_by_slug(self, slug: str) -> KbDocument | None:
        return await self._session.scalar(select(KbDocument).where(KbDocument.slug == slug))

    async def visible_document(self, slug: str, viewer: Viewer) -> KbDocument | None:
        stmt = select(KbDocument).where(KbDocument.slug == slug, _visible(viewer))
        return await self._session.scalar(stmt)

    async def delete_chunks(self, document_id: UUID) -> None:
        await self._session.execute(delete(KbChunk).where(KbChunk.document_id == document_id))

    async def full_text(self, query: str, viewer: Viewer, *, limit: int) -> list[UUID]:
        tsquery_text = or_query(query)
        if tsquery_text is None:
            return []
        tsquery = func.to_tsquery("russian", tsquery_text)
        rank = func.ts_rank_cd(KbChunk.search_vector, tsquery)
        stmt = (
            select(KbChunk.id)
            .join(KbDocument, KbChunk.document_id == KbDocument.id)
            .where(KbChunk.search_vector.op("@@")(tsquery), _visible(viewer))
            .order_by(rank.desc(), KbChunk.id)
            .limit(limit)
        )
        return list((await self._session.scalars(stmt)).all())

    async def nearest(
        self, embedding: Sequence[float], viewer: Viewer, *, limit: int
    ) -> list[UUID]:
        distance = KbChunk.embedding.cosine_distance(list(embedding))
        stmt = (
            select(KbChunk.id)
            .join(KbDocument, KbChunk.document_id == KbDocument.id)
            .where(KbChunk.embedding.is_not(None), _visible(viewer))
            .order_by(distance)
            .limit(limit)
        )
        return list((await self._session.scalars(stmt)).all())

    async def chunk_rows(self, chunk_ids: Sequence[UUID]) -> dict[UUID, ChunkRow]:
        if not chunk_ids:
            return {}
        stmt = (
            select(KbChunk, KbDocument, Team.name)
            .join(KbDocument, KbChunk.document_id == KbDocument.id)
            .outerjoin(Team, KbDocument.team_id == Team.id)
            .where(KbChunk.id.in_(chunk_ids))
        )
        rows = (await self._session.execute(stmt)).all()
        return {chunk.id: ChunkRow(chunk, document, team) for chunk, document, team in rows}

    async def conflicts_touching(self, chunk_ids: Sequence[UUID]) -> Sequence[KbConflict]:
        if not chunk_ids:
            return []
        stmt = select(KbConflict).where(
            or_(KbConflict.company_chunk_id.in_(chunk_ids), KbConflict.team_chunk_id.in_(chunk_ids))
        )
        return (await self._session.scalars(stmt)).all()

    async def conflict(self, conflict_id: UUID) -> KbConflict | None:
        return await self._session.get(KbConflict, conflict_id)

    async def chunks_by_topic(self, topic: str) -> Sequence[ChunkRow]:
        stmt = (
            select(KbChunk, KbDocument, Team.name)
            .join(KbDocument, KbChunk.document_id == KbDocument.id)
            .outerjoin(Team, KbDocument.team_id == Team.id)
            .where(KbChunk.topic == topic)
        )
        return [ChunkRow(c, d, t) for c, d, t in (await self._session.execute(stmt)).all()]

    async def chunks_without_embedding(self, *, limit: int) -> Sequence[KbChunk]:
        stmt = select(KbChunk).where(KbChunk.embedding.is_(None)).order_by(KbChunk.id).limit(limit)
        return (await self._session.scalars(stmt)).all()

    async def set_embedding(self, chunk_id: UUID, embedding: Sequence[float]) -> None:
        await self._session.execute(
            update(KbChunk).where(KbChunk.id == chunk_id).values(embedding=list(embedding))
        )

    async def embedded_share(self) -> tuple[int, int]:
        stmt = select(func.count(), func.count(KbChunk.embedding))
        total, embedded = (await self._session.execute(stmt)).one()
        return int(embedded), int(total)
