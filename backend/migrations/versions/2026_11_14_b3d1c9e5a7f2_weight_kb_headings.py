"""weight knowledge headings above body text in full-text search

Revision ID: b3d1c9e5a7f2
Revises: 7126fd695553
Create Date: 2026-11-14 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b3d1c9e5a7f2"
down_revision: str | None = "7126fd695553"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

WEIGHTED = (
    "setweight(to_tsvector('russian', heading), 'A') || "
    "setweight(to_tsvector('russian', content), 'B')"
)
PLAIN = "to_tsvector('russian', heading || ' ' || content)"


def _replace_vector(expression: str) -> None:
    # A generated column can't be altered in place: drop the index and column, add them back.
    op.drop_index("ix_kb_chunks_search_vector", table_name="kb_chunks", postgresql_using="gin")
    op.drop_column("kb_chunks", "search_vector")
    op.add_column(
        "kb_chunks",
        sa.Column(
            "search_vector",
            postgresql.TSVECTOR(),
            sa.Computed(expression, persisted=True),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_kb_chunks_search_vector", "kb_chunks", ["search_vector"], unique=False, postgresql_using="gin"
    )


def upgrade() -> None:
    _replace_vector(WEIGHTED)


def downgrade() -> None:
    _replace_vector(PLAIN)
