from collections.abc import Iterator
from contextlib import contextmanager

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
    start_http_server,
)

from app.domain.events import Topic

# Process-wide registry (the default one): metrics are cheap counters, safe to define at import.

HTTP_LATENCY = Histogram(
    "buddy_http_request_seconds",
    "HTTP request latency",
    ["method", "route", "status"],
    buckets=(0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)
CHAT_FIRST_TOKEN = Histogram(
    "buddy_chat_first_token_seconds",
    "Time from a chat request to the first streamed text",
    ["mode"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8, 16),
)
CHAT_TURNS = Counter("buddy_chat_turns_total", "Assistant turns", ["mode", "outcome"])
TOOL_CALLS = Counter("buddy_tool_calls_total", "Assistant tool calls", ["tool", "outcome"])
ACTIONS = Counter("buddy_actions_total", "Confirmation card decisions", ["tool", "decision"])
CORP_CALLS = Counter("buddy_corp_calls_total", "Calls to corporate services", ["tool", "outcome"])
LLM_FALLBACKS = Counter("buddy_llm_fallbacks_total", "Turns that fell back to offline mode")
OUTBOX_EVENTS = Counter(
    "buddy_outbox_events_total", "Delivered outbox events", ["topic", "outcome"]
)
OUTBOX_DURATION = Histogram("buddy_outbox_processing_seconds", "Outbox handler duration", ["topic"])
OUTBOX_BACKLOG = Gauge("buddy_outbox_backlog", "Unfinished outbox events", ["topic", "state"])
OUTBOX_OLDEST = Gauge("buddy_outbox_oldest_seconds", "Oldest unfinished event age", ["topic"])
OUTBOX_SNAPSHOT = Gauge(
    "buddy_outbox_snapshot_timestamp_seconds", "Last successful backlog refresh"
)
WORKER_JOBS = Counter("buddy_worker_jobs_total", "Background job runs", ["task", "outcome"])
WORKER_JOB_ITEMS = Counter(
    "buddy_worker_job_items_total", "Background job affected items", ["task"]
)
WORKER_JOB_DURATION = Histogram("buddy_worker_job_seconds", "Background job duration", ["task"])
SSE_ACTIVE = Gauge("buddy_sse_active_connections", "Active SSE responses", ["route"])


def metric_topic(topic: str) -> str:
    return topic if topic in Topic else "other"


def metric_job(job: str) -> str:
    known = {
        "escalations",
        "reconcile",
        "overdue",
        "sla",
        "equipment",
        "digest",
        "sessions-cleanup",
        "embed-backfill",
        "conflict-check",
        "outbox-metrics",
    }
    return job if job in known else "other"


def render() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST


@contextmanager
def worker_metrics_server(*, enabled: bool, host: str, port: int) -> Iterator[None]:
    if not enabled:
        yield
        return
    server, thread = start_http_server(port, addr=host)
    try:
        yield
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
