"""Fit client idempotency keys together with their server-side user namespace.

Revision ID: e91f2a6c840d
Revises: c7a4e21b9d08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e91f2a6c840d"
down_revision: str | None = "c7a4e21b9d08"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("service_requests", "idempotency_key", type_=sa.String(256))


def downgrade() -> None:
    # PostgreSQL refuses lossy truncation if longer keys exist; it never silently corrupts keys.
    op.alter_column("service_requests", "idempotency_key", type_=sa.String(128))
