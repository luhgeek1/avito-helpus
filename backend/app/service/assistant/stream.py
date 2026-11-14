import json
from typing import Any

# Vercel AI SDK "UI message stream" v1: Server-Sent Events, one JSON chunk per event.
# The frontend can feed it to `useChat` (custom transport) or parse it by hand.
STREAM_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
    "x-vercel-ai-ui-message-stream": "v1",
}
DONE = "data: [DONE]\n\n"


def sse(chunk: dict[str, Any]) -> str:
    return f"data: {json.dumps(chunk, ensure_ascii=False, default=str)}\n\n"


def start(message_id: str, metadata: dict[str, Any] | None = None) -> str:
    chunk: dict[str, Any] = {"type": "start", "messageId": message_id}
    if metadata:
        chunk["messageMetadata"] = metadata
    return sse(chunk)


def text_start(part_id: str) -> str:
    return sse({"type": "text-start", "id": part_id})


def text_delta(part_id: str, delta: str) -> str:
    return sse({"type": "text-delta", "id": part_id, "delta": delta})


def text_end(part_id: str) -> str:
    return sse({"type": "text-end", "id": part_id})


def tool_input(tool_call_id: str, tool_name: str, args: dict[str, Any]) -> str:
    return sse(
        {
            "type": "tool-input-available",
            "toolCallId": tool_call_id,
            "toolName": tool_name,
            "input": args,
        }
    )


def tool_output(tool_call_id: str, output: Any) -> str:
    return sse({"type": "tool-output-available", "toolCallId": tool_call_id, "output": output})


def data(part_type: str, payload: dict[str, Any], *, transient: bool = False) -> str:
    chunk: dict[str, Any] = {
        "type": part_type if part_type.startswith("data-") else f"data-{part_type}",
        "data": payload,
    }
    if transient:
        chunk["transient"] = True
    return sse(chunk)


def status(text: str, *, mode: str | None = None) -> str:
    payload: dict[str, Any] = {"text": text}
    if mode:
        payload["mode"] = mode
    return data("status", payload, transient=True)


def error(text: str) -> str:
    return sse({"type": "error", "errorText": text})


def finish(metadata: dict[str, Any] | None = None) -> str:
    chunk: dict[str, Any] = {"type": "finish"}
    if metadata:
        chunk["messageMetadata"] = metadata
    return sse(chunk)
