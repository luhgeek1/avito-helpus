from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

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


def render() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST
