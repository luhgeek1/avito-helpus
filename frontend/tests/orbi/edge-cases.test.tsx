import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { z } from "zod";
import { createPortalQueryClient } from "@/_app/model/portal-provider";
import { DocumentBody, DocumentModal, errorText } from "@/_pages/orbi/ui/common";
import { SourcesBlock, ActionCardView } from "@/features/orbi-chat/ui/cards";
import { OrbiMessageList, useOrbiChat } from "@/features/orbi-chat";
import type { ActionData, SourcesData } from "@/features/orbi-chat/model/message";
import { orbiJson, orbiKeys, readSse, refreshSession, tokens, useKnowledgeSearch, useSession } from "@/shared/api";
import { server } from "../portal/setup";
import { fixture, problem, signIn, url } from "./server";
import { defaultPet } from "@/entities/pet";
import { CompanionSpotlight } from "@/widgets/pet-companion/ui/companion-spotlight";
import type { CompanionChatModel } from "@/widgets/pet-companion/model/use-companion-chat";
import type { OrbiMessage } from "@/features/orbi-chat";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={createPortalQueryClient()}>{children}</QueryClientProvider>;
}

it("ignores Spotlight submits while busy and does not reopen a closed window after a late reply", async () => {
  let finish!: (reply: OrbiMessage) => void;
  const pending = new Promise<OrbiMessage>((resolve) => { finish = resolve; });
  const send = vi.fn(() => pending), onReply = vi.fn(), onOpenChat = vi.fn();
  const chat: CompanionChatModel = { messages: [], draft: "Question", setDraft: vi.fn(), send,
    load: vi.fn(), busy: true, authenticated: true, status: "authenticated", ready: false };
  const view = (model: CompanionChatModel) => <CompanionSpotlight pet={defaultPet} chat={model} onClose={vi.fn()} onReply={onReply} onOpenChat={onOpenChat} />;
  const { rerender, unmount } = render(view(chat));
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  expect(send).not.toHaveBeenCalled();
  rerender(view({ ...chat, busy: false, ready: true }));
  await userEvent.click(screen.getByRole("button", { name: "Отправить запрос" }));
  expect(onReply).toHaveBeenCalledOnce();
  unmount();
  await act(async () => finish({ id: "late", role: "assistant", createdAt: "", parts: [{ type: "text", id: "t", text: "Late reply" }] }));
  expect(onReply).toHaveBeenCalledOnce();
  expect(onOpenChat).not.toHaveBeenCalled();
});

it("reports each conflicting instruction independently, surfaces errors, and retries", async () => {
  signIn();
  const conflict = { id: "one", topic: "PR", summary: "First", company: { title: "C", section: "S", excerpt: "main" }, team: { title: "T", section: "S", excerpt: "develop" } };
  const data: SourcesData = { query: "q", mode: "online", sources: [], conflicts: [conflict, { ...conflict, id: "two", summary: "Second" }] };
  const calls: string[] = [];
  server.use(http.post(url("/knowledge/conflicts/:id/report"), ({ params }) => {
    calls.push(String(params.id));
    return calls.length === 1 ? problem(500, "INTERNAL_ERROR") : HttpResponse.json(fixture<object[]>("escalations-kirill.json")[0]);
  }));
  render(<Wrapper><SourcesBlock data={data} /></Wrapper>);
  const notes = screen.getAllByRole("note");
  await userEvent.click(within(notes[0]).getByRole("button"));
  expect(await within(notes[0]).findByRole("alert")).toHaveTextContent("Не удалось передать вопрос");
  await userEvent.click(within(notes[0]).getByRole("button"));
  expect(await within(notes[0]).findByRole("button")).toHaveTextContent("Вопрос передан");
  expect(within(notes[1]).getByRole("button")).toBeEnabled();
  expect(within(notes[1]).getByRole("button")).toHaveTextContent("Уточнить у наставника");
  expect(calls).toEqual(["one", "one"]);
});

it("keeps decision errors on their card instead of offering to resend the original request", () => {
  useOrbiChat.setState({ messages: [
    { id: "u", role: "user", parts: [{ type: "text", id: "t", text: "Get access" }], createdAt: "" },
    { id: "a", role: "assistant", parts: [], createdAt: "", error: "Try the card", decisionReply: true },
  ] });
  render(<Wrapper><OrbiMessageList name="Орби" /></Wrapper>);
  expect(screen.getByRole("alert")).toHaveTextContent("Try the card");
  expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
});

it("records a negative answer rating through the message UI", async () => {
  useOrbiChat.setState({ messages: [{ id: "answer", role: "assistant", parts: [{ type: "text", id: "t", text: "Answer" }], createdAt: "" }] });
  render(<Wrapper><OrbiMessageList name="Орби" /></Wrapper>);
  await userEvent.click(screen.getByRole("button", { name: "Бесполезный ответ" }));
  expect(screen.getByRole("button", { name: "Бесполезный ответ" })).toHaveAttribute("aria-pressed", "true");
});

it("renders a rejected decision and permits changing a free-text field", async () => {
  const data: ActionData = { id: "a", tool: "request", status: "pending", expires_at: "2099-01-01", card: {
    kind: "access", service: "Service", title: "Card", fields: [{ key: "comment", label: "Комментарий", value: "old", editable: true }], warnings: ["Check before sending"],
  } };
  const decide = vi.fn();
  render(<ActionCardView data={data} busy={false} onDecide={decide} />);
  expect(screen.getByText("Check before sending")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Изменить" }));
  await userEvent.clear(screen.getByRole("textbox"));
  await userEvent.type(screen.getByRole("textbox"), "new");
  await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));
  expect(decide).toHaveBeenCalledWith("approve", { comment: "new" });
});

it("renders numbered lists, headings and comments in a knowledge document", () => {
  render(<DocumentBody body={"<!-- synthetic -->\n\n# Main\n\n## Section\nSection content\n\n1. **First**\n2. Second\n\nParagraph"} />);
  expect(screen.getAllByRole("heading")).toHaveLength(2);
  expect(screen.getByRole("heading", { name: "Section" })).toBeInTheDocument();
  expect(screen.getByText("Section content").tagName).toBe("P");
  expect(screen.getAllByRole("listitem").map((el) => el.textContent)).toEqual(["First", "Second"]);
  expect(screen.queryByText(/synthetic/)).not.toBeInTheDocument();
  expect(errorText(new Error("Unknown"))).toBe("Не получилось. Попробуй ещё раз");
});

it("retries loading a knowledge document", async () => {
  signIn();
  server.use(http.get(url("/knowledge/documents/doc"), () => problem(500, "INTERNAL_ERROR"), { once: true }));
  render(<Wrapper><DocumentModal slug="doc" onClose={vi.fn()} /></Wrapper>);
  await userEvent.click(await screen.findByRole("button", { name: "Повторить" }));
  expect(await screen.findByRole("dialog", { name: "Принципы разработки" })).toBeInTheDocument();
});

it("gates knowledge search until a signed-in user enters at least two characters", async () => {
  let queries = 0;
  server.use(http.get(url("/knowledge/search"), ({ request }) => {
    queries += 1;
    expect(new URL(request.url).searchParams.get("q")).toBe("PR & review");
    return HttpResponse.json({ query: "PR & review", mode: "offline", sources: [], conflicts: [] });
  }));
  const { result, rerender } = renderHook(({ q }) => useKnowledgeSearch(q), { wrapper: Wrapper, initialProps: { q: "x" } });
  expect(result.current.fetchStatus).toBe("idle");
  act(() => signIn());
  rerender({ q: "PR & review" });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(queries).toBe(1);
  expect(orbiKeys.request("r")).toEqual(["orbi", "requests", "r"]);
  expect(orbiKeys.search("q")).toEqual(["orbi", "search", "q"]);
});

it("validates malformed JSON, including a successful 202 with a response body", async () => {
  server.use(
    http.get(url("/bad"), () => new HttpResponse("not json")),
    http.get(url("/accepted"), () => HttpResponse.json({ accepted: true }, { status: 202 })),
  );
  await expect(orbiJson("/bad", z.unknown())).rejects.toMatchObject({ code: "BAD_RESPONSE" });
  await expect(orbiJson("/accepted", z.object({ accepted: z.boolean() }))).resolves.toEqual({ accepted: true });
});

it("keeps the current token on a transient refresh network failure and rejects invalid token payloads", async () => {
  tokens.set("current");
  server.use(http.post(url("/auth/refresh"), () => HttpResponse.error()));
  await expect(refreshSession()).resolves.toBeNull();
  expect(tokens.get()).toBe("current");
  server.use(http.post(url("/auth/refresh"), () => HttpResponse.json({ access_token: 123 })));
  await expect(refreshSession()).resolves.toBeNull();
});

it("cancels an unread SSE response when its consumer exits early or starts already aborted", async () => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode("data: first\n\n")); }, cancel });
  for await (const event of readSse(body)) { expect(event.data).toBe("first"); break; }
  expect(cancel).toHaveBeenCalledOnce();
  const controller = new AbortController(); controller.abort();
  const seen: string[] = [];
  for await (const event of readSse(new ReadableStream(), controller.signal)) seen.push(event.data);
  expect(seen).toEqual([]);
});

it("does not restore history into a fresh dialog after start-over", async () => {
  signIn();
  useOrbiChat.getState().startOver();
  await useOrbiChat.getState().load();
  expect(useOrbiChat.getState()).toMatchObject({ loaded: true, messages: [], conversationId: null });
  await useSession.getState().logout();
  expect(tokens.get()).toBeNull();
});
