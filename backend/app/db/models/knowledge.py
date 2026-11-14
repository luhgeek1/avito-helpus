from datetime import date
from uuid import UUID

from pgvector.sqlalchemy import Vector
from sqlalchemy import Computed, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UuidPkMixin, pg_enum
from app.domain.knowledge import ConflictStatus, DocKind, DocScope

EMBEDDING_DIM = 1024


class KbDocument(UuidPkMixin, TimestampMixin, Base):
    __tablename__ = "kb_documents"

    slug: Mapped[str] = mapped_column(String(100), unique=True)
    title: Mapped[str] = mapped_column(String(300))
    kind: Mapped[DocKind] = mapped_column(pg_enum(DocKind, "kb_doc_kind"))
    scope: Mapped[DocScope] = mapped_column(pg_enum(DocScope, "kb_doc_scope"))
    team_id: Mapped[UUID | None] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"))
    # Empty = visible to every role; otherwise only the listed roles see it.
    roles: Mapped[list[str]] = mapped_column(ARRAY(String(16)), default=list, server_default="{}")
    owner: Mapped[str] = mapped_column(String(200), default="", server_default="")
    source_label: Mapped[str] = mapped_column(String(200))
    source_url: Mapped[str | None] = mapped_column(String(500))
    doc_updated_at: Mapped[date]
    body: Mapped[str] = mapped_column(Text)


class KbChunk(UuidPkMixin, Base):
    __tablename__ = "kb_chunks"

    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("kb_documents.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int]
    heading: Mapped[str] = mapped_column(String(300))
    content: Mapped[str] = mapped_column(Text)
    topic: Mapped[str | None] = mapped_column(String(100), index=True)
    search_vector: Mapped[str] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('russian', heading || ' ' || content)", persisted=True),
    )
    embedding: Mapped[list[float] | None] = mapped_column(Vector(EMBEDDING_DIM))

    __table_args__ = (
        Index("ix_kb_chunks_search_vector", "search_vector", postgresql_using="gin"),
        Index(
            "ix_kb_chunks_embedding",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class KbConflict(UuidPkMixin, TimestampMixin, Base):
    """A company rule and a team rule on the same topic that disagree."""

    __tablename__ = "kb_conflicts"

    topic: Mapped[str] = mapped_column(String(100))
    company_chunk_id: Mapped[UUID] = mapped_column(ForeignKey("kb_chunks.id", ondelete="CASCADE"))
    team_chunk_id: Mapped[UUID] = mapped_column(ForeignKey("kb_chunks.id", ondelete="CASCADE"))
    summary: Mapped[str] = mapped_column(Text)
    status: Mapped[ConflictStatus] = mapped_column(
        pg_enum(ConflictStatus, "kb_conflict_status"),
        default=ConflictStatus.OPEN,
        server_default=ConflictStatus.OPEN.value,
    )
    detected_by: Mapped[str] = mapped_column(String(32), default="owner", server_default="owner")

    __table_args__ = (
        Index("uq_kb_conflicts_pair", "company_chunk_id", "team_chunk_id", unique=True),
    )
