"""Safe Grafana aggregates and a dedicated read-only role.

Revision ID: c7a4e21b9d08
Revises: b3d1c9e5a7f2
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c7a4e21b9d08"
down_revision: str | None = "b3d1c9e5a7f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Fail on a conflicting cluster-wide role rather than reusing unknown privileges.
    op.execute("""
        CREATE ROLE orbi_grafana NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
          NOINHERIT NOREPLICATION NOBYPASSRLS
    """)
    op.execute("ALTER ROLE orbi_grafana SET default_transaction_read_only = on")
    op.execute("ALTER ROLE orbi_grafana SET statement_timeout = '10s'")
    op.execute("GRANT USAGE ON SCHEMA public TO orbi_grafana")
    # The owner resolves base tables; Grafana sees no ids, arbitrary JSON or free text.
    op.execute("""
        CREATE VIEW analytics_dashboard_events AS
        SELECT created_at, name,
          CASE WHEN properties->>'rating' IN ('up','down') THEN properties->>'rating' END AS rating,
          CASE WHEN properties->>'decision' IN ('approve','reject') THEN properties->>'decision' END AS decision,
          CASE WHEN properties->>'kind' IN ('access','absence','equipment','question','conflict','blocker','sensitive')
            THEN properties->>'kind' END AS kind,
          CASE WHEN properties->>'status' IN ('approved','rejected','failed','cancelled')
            THEN properties->>'status' END AS status,
          CASE WHEN properties->>'mode' IN ('online','offline','hybrid','fts')
            THEN properties->>'mode' END AS mode,
          CASE WHEN variant IN ('a','b','control','treatment') THEN variant END AS variant
        FROM analytics_events
        WHERE name IN ('chat.message','chat.fallback','tool.called','action.proposed','action.decided',
          'request.created','request.resolved','plan.item_done','escalation.created','escalation.answered',
          'answer.feedback','knowledge.search','ui.event')
    """)
    # Exact same sources, filters and rounding as GET /analytics/summary (default 30 days).
    # Escalations and plan state cannot be reconstructed from append-only event counts.
    op.execute("""
        CREATE VIEW analytics_dashboard_summary AS
        WITH events AS (
          SELECT
            count(*) FILTER (WHERE name = 'knowledge.search') AS questions_total,
            count(*) FILTER (WHERE name = 'answer.feedback' AND properties->>'rating' = 'up') AS feedback_up,
            count(*) FILTER (WHERE name = 'answer.feedback' AND properties->>'rating' = 'down') AS feedback_down,
            count(*) FILTER (WHERE name = 'chat.fallback') AS fallbacks
          FROM analytics_events WHERE created_at >= now() - interval '30 days'
        ), escalations_summary AS (
          SELECT count(*) AS escalations_total,
            count(*) FILTER (WHERE status != 'open') AS escalations_resolved,
            round(avg(extract(epoch FROM answered_at - created_at) / 3600)::numeric, 2) AS escalation_hours_avg
          FROM escalations WHERE created_at >= now() - interval '30 days'
        ), access_summary AS (
          SELECT count(*) AS access_requests_approved,
            round(avg(extract(epoch FROM resolved_at - created_at) / 3600)::numeric, 2) AS access_hours_avg
          FROM service_requests WHERE kind = 'access' AND status = 'approved'
            AND created_at >= now() - interval '30 days'
        ), plan_summary AS (
          SELECT count(*) FILTER (WHERE status = 'done' AND completed_at::date <= due_date) AS on_time,
            count(*) FILTER (WHERE status = 'done' OR due_date < current_date) AS due
          FROM plan_items
        )
        SELECT 30 AS period_days, events.*, escalations_summary.*, access_summary.*,
          round(1 - escalations_total::numeric / nullif(questions_total, 0), 3) AS resolved_without_mentor_share,
          round(on_time::numeric / nullif(due, 0), 3) AS plan_on_time_share
        FROM events, escalations_summary, access_summary, plan_summary
    """)
    op.execute("REVOKE ALL ON analytics_dashboard_events, analytics_dashboard_summary FROM PUBLIC")
    op.execute("GRANT SELECT ON analytics_dashboard_events, analytics_dashboard_summary TO orbi_grafana")


def downgrade() -> None:
    op.execute("DROP VIEW analytics_dashboard_summary")
    op.execute("DROP VIEW analytics_dashboard_events")
    op.execute("REVOKE USAGE ON SCHEMA public FROM orbi_grafana")
    op.execute("DROP ROLE orbi_grafana")
