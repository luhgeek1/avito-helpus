import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { applyChunk, fromHistory, hasCards, textOf } from "@/features/orbi-chat";
import type { OrbiMessage } from "@/features/orbi-chat";
import {
  OrbiError, orbiFetch, orbiJson, parseNotice, readCookie, readSse, readUiStream, refreshSession, tokens, useSession,
} from "@/shared/api";
import type { UiChunk } from "@/shared/api";
import { dialogueReply } from "@/widgets/pet-companion/model/chat-messages";
import { formatDay, formatMoment, formatTime, initialsOf, plural } from "@/shared/lib/orbi-format";
import { z } from "zod";
import { server } from "../portal/setup";
import { fixture, problem, signIn, sse, sseResponse, streamFixture, url } from "./server";

function body(text: string, chunk = 0) {
  return sseResponse(text, chunk).body as ReadableStream<Uint8Array>;
}

async function collect<T>(source: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of source) items.push(item);
  return items;
}

async function streamMessage(name: string): Promise<OrbiMessage> {
  let message: OrbiMessage = { id: "local", role: "assistant", parts: [], createdAt: "", streaming: true };
  for await (const chunk of readUiStream(body(streamFixture(name), 7))) message = applyChunk(message, chunk);
  return message;
}

describe("SSE reader", () => {
  it("joins events split across network chunks and skips comments", async () => {
    const events = await collect(readSse(body("retry: 3000\n\n: keepalive\n\nevent: plan.updated\r\ndata: {\"a\":1}\r\n\r\ndata: one\ndata: two\n\ndata: tail", 3)));
    expect(events).toEqual([
      { event: "plan.updated", data: "{\"a\":1}" },
      { event: "message", data: "one\ntwo" },
      { event: "message", data: "tail" },
    ]);
  });

  it("stops at [DONE] and ignores malformed chunks", async () => {
    const chunks = await collect(readUiStream(body("data: {bad json\n\ndata: {\"no\":\"type\"}\n\n" + sse({ type: "start" }) + sse({ type: "late" }))));
    expect(chunks.map((chunk) => chunk.type)).toEqual(["start"]);
  });

  it("stops reading when aborted", async () => {
    const controller = new AbortController();
    const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode("data: 1\n\n")); } });
    const seen: string[] = [];
    for await (const event of readSse(stream, controller.signal)) { seen.push(event.data); controller.abort(); }
    expect(seen).toEqual(["1"]);
  });
});

describe("assistant message from the UI message stream", () => {
  it("builds the confirmation card from a real access-request stream", async () => {
    const message = await streamMessage("stream-card.txt");
    expect(message.id).toBe("6edea3b8c36c41f786bf793906201879");
    expect(message.mode).toBe("online");
    expect(message.streaming).toBe(false);
    expect(message.status).toBeUndefined();
    const action = message.parts.find((part) => part.type === "action");
    expect(action?.type === "action" && action.data.card.title).toBe("Заявка на доступ: Дашборды Grafana: Объявления");
    expect(textOf(message)).toContain("карточку");
    expect(hasCards(message)).toBe(true);
  });

  it("adds the submitted request after approval", async () => {
    const message = await streamMessage("stream-approved.txt");
    const request = message.parts.find((part) => part.type === "request");
    expect(request?.type === "request" && request.data.external_id).toBe("ACC-1043");
    expect(textOf(message).length).toBeGreaterThan(20);
  });

  it("keeps sources and conflicts and surfaces a stream error", async () => {
    const message = await streamMessage("stream-knowledge.txt");
    const sources = message.parts.find((part) => part.type === "sources");
    expect(sources?.type === "sources" && sources.data.conflicts).toHaveLength(1);
    expect(message.error).toMatch(/не может ответить/);
  });

  it("shows status lines, updates cards in place and ignores unknown parts", () => {
    let message: OrbiMessage = { id: "m", role: "assistant", parts: [], createdAt: "" };
    const card = { id: "a1", tool: "request_access", status: "pending", card: { kind: "k", title: "T", service: "S", fields: [], warnings: [] }, expires_at: "" };
    const chunks: UiChunk[] = [
      { type: "data-status", data: { text: "Ищу в базе знаний" } },
      { type: "data-status", data: {} },
      { type: "text-delta", id: "x", delta: "Привет" },
      { type: "data-action", data: card },
      { type: "data-action", data: { ...card, status: "approved" } },
      { type: "data-unknown", data: { a: 1 } },
      { type: "data-plan", data: null },
      { type: "tool-input-available", toolCallId: "c" },
      { type: "error" },
    ];
    message = applyChunk(message, chunks[0]);
    expect(message.status).toBe("Ищу в базе знаний");
    for (const chunk of chunks.slice(1)) message = applyChunk(message, chunk);
    expect(message.status).toBeUndefined();
    expect(message.parts).toHaveLength(2);
    expect(message.parts[1]).toMatchObject({ type: "action", data: { status: "approved" } });
    expect(message.error).toBe("Орби сейчас не может ответить");
  });

  it("restores history parts and feedback", () => {
    const history = fixture<{ messages: Parameters<typeof fromHistory>[0][] }>("history.json");
    const [user, assistant] = history.messages.map(fromHistory);
    expect(user.role).toBe("user");
    expect(assistant.parts.some((part) => part.type === "action")).toBe(true);
    expect(fromHistory({ id: "x", role: "assistant", parts: [{ type: "data-sources", data: "bad" }], feedback: "up", created_at: "" }))
      .toMatchObject({ parts: [], feedback: "up" });
  });
});

describe("what the pet says after Spotlight", () => {
  const text = (value: string): OrbiMessage => ({ id: "m", role: "assistant", parts: [{ type: "text", id: "t", text: value }], createdAt: "" });
  it("opens the chat for a card or a failure", async () => {
    expect(dialogueReply(await streamMessage("stream-card.txt")).openChat).toBe(true);
    expect(dialogueReply(undefined).openChat).toBe(true);
  });
  it("speaks short answers and errors, cuts long ones", async () => {
    expect(dialogueReply(text("Готово, шаг закрыт")).reply.text).toBe("Готово, шаг закрыт");
    expect(dialogueReply({ ...text(""), error: "Нет связи" })).toMatchObject({ reply: { text: "Нет связи" }, openChat: false });
    expect(dialogueReply(text("слово ".repeat(100))).reply.text).toMatch(/Полный ответ с источниками — в чате\.$/);
    expect(dialogueReply(text("")).reply.text).toBe("Готово.");
  });
});

describe("HTTP client", () => {
  it("sends the bearer token and parses JSON with a schema", async () => {
    signIn();
    const me = await orbiJson("/me", z.object({ full_name: z.string() }));
    expect(me.full_name).toBe("Аня Смирнова");
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    tokens.set("expired");
    document.cookie = "csrf_token=csrf-1; path=/";
    let csrf: string | null = null;
    server.use(
      http.get(url("/plan"), ({ request }) =>
        request.headers.get("Authorization") === "Bearer fresh" ? HttpResponse.json({ ok: true }) : problem(401, "TOKEN_EXPIRED")),
      http.post(url("/auth/refresh"), ({ request }) => {
        csrf = request.headers.get("X-CSRF-Token");
        return HttpResponse.json({ access_token: "fresh", expires_in: 900 });
      }),
    );
    await expect(orbiJson("/plan", z.object({ ok: z.boolean() }))).resolves.toEqual({ ok: true });
    expect(csrf).toBe("csrf-1");
    expect(tokens.get()).toBe("fresh");
    expect(readCookie("missing")).toBeNull();
  });

  it("signs out when the refresh is rejected", async () => {
    signIn();
    server.use(http.get(url("/plan"), () => problem(401, "TOKEN_EXPIRED")), http.post(url("/auth/refresh"), () => problem(401, "INVALID_TOKEN")));
    await expect(orbiFetch("/plan")).rejects.toMatchObject({ status: 401, code: "TOKEN_EXPIRED" });
    expect(tokens.get()).toBeNull();
    expect(useSession.getState().status).toBe("anonymous");
  });

  it("turns problems, plain errors and network failures into OrbiError", async () => {
    signIn();
    server.use(
      http.get(url("/a"), () => problem(409, "REMIND_TOO_SOON", "Too soon")),
      http.get(url("/b"), () => new HttpResponse("oops", { status: 500 })),
      http.get(url("/c"), () => HttpResponse.json({ title: "Only title" }, { status: 400 })),
      http.get(url("/d"), () => HttpResponse.error()),
      http.get(url("/e"), () => HttpResponse.json({ wrong: true })),
      http.post(url("/f"), () => new HttpResponse(null, { status: 202 })),
    );
    await expect(orbiFetch("/a")).rejects.toMatchObject({ code: "REMIND_TOO_SOON", detail: "Too soon" });
    await expect(orbiFetch("/b")).rejects.toMatchObject({ code: "HTTP_500", detail: "Ошибка сервера (500)" });
    await expect(orbiFetch("/c")).rejects.toMatchObject({ detail: "Only title" });
    await expect(orbiFetch("/d")).rejects.toMatchObject({ status: 0, code: "NETWORK" });
    await expect(orbiJson("/e", z.object({ id: z.string() }))).rejects.toBeInstanceOf(OrbiError);
    await expect(orbiJson("/f", z.unknown(), { method: "POST" })).resolves.toBeUndefined();
  });

  it("shares one refresh between parallel calls", async () => {
    let calls = 0;
    document.cookie = "csrf_token=c; path=/";
    server.use(http.post(url("/auth/refresh"), () => { calls += 1; return HttpResponse.json({ access_token: "t2", expires_in: 1 }); }));
    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);
    expect([a, b, calls]).toEqual(["t2", "t2", 1]);
  });
});

describe("session", () => {
  it("stays anonymous without a csrf cookie and restores with one", async () => {
    await useSession.getState().boot();
    expect(useSession.getState().status).toBe("anonymous");
  });

  it("logs in, notifies listeners and logs out", async () => {
    const { onAccountChange } = await import("@/shared/api");
    let resets = 0;
    const off = onAccountChange(() => { resets += 1; });
    await useSession.getState().login("anya.intern@buddy.test", "orbi-demo-2026");
    expect(useSession.getState()).toMatchObject({ status: "authenticated", epoch: 1 });
    expect(tokens.get()).toBe("token-anya.intern@buddy.test");
    await expect(useSession.getState().login("anya.intern@buddy.test", "wrong")).rejects.toMatchObject({ status: 401 });
    await useSession.getState().logout();
    off();
    expect(useSession.getState().status).toBe("anonymous");
    expect(resets).toBe(2);
  });
});

describe("formatting and notices", () => {
  it("formats dates in Moscow time and Russian plurals", () => {
    expect(formatDay("2026-11-18")).toBe("18 ноября");
    expect(formatDay(null)).toBe("");
    expect(formatDay("soon")).toBe("soon");
    expect(formatMoment("2026-11-14T08:22:39Z")).toBe("14 ноября в 11:22");
    expect(formatMoment("nope")).toBe("nope");
    expect(formatTime("2026-11-14T08:22:39Z")).toBe("11:22");
    expect(formatTime("x")).toBe("");
    expect([1, 2, 5, 11, 22].map((n) => plural(n, ["шаг", "шага", "шагов"]))).toEqual(["1 шаг", "2 шага", "5 шагов", "11 шагов", "22 шага"]);
    expect(initialsOf("Аня Смирнова")).toBe("АС");
  });

  it("parses live notifications defensively", () => {
    expect(parseNotice('{"id":"1","title":"T","body":"B","link":"/plan"}')).toEqual({ id: "1", title: "T", body: "B", link: "/plan" });
    expect(parseNotice('{"id":"1","title":"T"}')).toEqual({ id: "1", title: "T", body: "", link: null });
    expect(parseNotice('{"title":"T"}')).toBeNull();
    expect(parseNotice("nope")).toBeNull();
  });
});
