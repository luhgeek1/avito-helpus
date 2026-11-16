"""Requests to the code review, office booking and learning services.

Revision ID: 5d2e8b7c1a40
Revises: e91f2a6c840d
"""

from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

revision: str = "5d2e8b7c1a40"
down_revision: str | None = "e91f2a6c840d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NEW_KINDS = ("review", "booking", "learning")
# The Grafana summary view reads service_requests.kind, so the type change has to recreate it.
VIEW = "analytics_dashboard_summary"


def upgrade() -> None:
    for kind in NEW_KINDS:
        op.execute(f"ALTER TYPE request_kind ADD VALUE IF NOT EXISTS '{kind}'")


def downgrade() -> None:
    # PostgreSQL cannot drop enum values: rebuild the type without them. Requests of the new
    # kinds cannot exist in the old schema, so they go (their events cascade, plan links clear).
    bind = op.get_bind()
    definition = bind.execute(text(f"SELECT pg_get_viewdef('{VIEW}'::regclass, true)")).scalar_one()
    op.execute("DELETE FROM service_requests WHERE kind::text IN ('review', 'booking', 'learning')")
    op.execute(f"DROP VIEW {VIEW}")
    op.execute("ALTER TYPE request_kind RENAME TO request_kind_old")
    op.execute("CREATE TYPE request_kind AS ENUM ('access', 'absence', 'equipment')")
    op.execute(
        "ALTER TABLE service_requests ALTER COLUMN kind TYPE request_kind "
        "USING kind::text::request_kind"
    )
    op.execute("DROP TYPE request_kind_old")
    op.execute(f"CREATE VIEW {VIEW} AS {definition}")
    op.execute(f"REVOKE ALL ON {VIEW} FROM PUBLIC")
    op.execute(f"GRANT SELECT ON {VIEW} TO orbi_grafana")
