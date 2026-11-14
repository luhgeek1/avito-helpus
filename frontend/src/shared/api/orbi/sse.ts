export type SseEvent = { event: string; data: string };

/** Splits a text/event-stream body into events; comments and `retry:` lines are skipped. */
export async function* readSse(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal?.addEventListener("abort", abort, { once: true });
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      // Normalise the whole buffer: a CRLF pair may arrive split across two network chunks.
      buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const parsed = parseBlock(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (parsed) yield parsed;
        boundary = buffer.indexOf("\n\n");
      }
    }
    const tail = parseBlock(buffer);
    if (tail) yield tail;
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

function parseBlock(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  return data.length ? { event, data: data.join("\n") } : null;
}

/** AI SDK UI message stream chunk (only the fields we use are typed). */
export type UiChunk = { type: string; [key: string]: unknown };

export async function* readUiStream(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncGenerator<UiChunk> {
  for await (const { data } of readSse(body, signal)) {
    if (data === "[DONE]") return;
    try {
      const chunk = JSON.parse(data) as unknown;
      if (chunk && typeof chunk === "object" && typeof (chunk as UiChunk).type === "string") yield chunk as UiChunk;
    } catch {
      // A malformed chunk is skipped; the rest of the answer still renders.
    }
  }
}
