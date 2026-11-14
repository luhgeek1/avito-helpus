import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { createPortalQueryClient } from "@/_app/model/portal-provider";
import { useOrbiChat } from "@/features/orbi-chat";
import { CompanionChat } from "@/widgets/pet-companion/ui/companion-chat";
import { useCompanionChat } from "@/widgets/pet-companion/model/use-companion-chat";
import { useSession } from "@/shared/api";
import { server } from "../portal/setup";
import { fixture, problem, signIn, sse, sseResponse, streamFixture, url } from "./server";

function Harness() {
  const chat = useCompanionChat();
  return <CompanionChat name="Орби" chat={chat} onClose={vi.fn()} onBack={vi.fn()} />;
}

function renderChat() {
  const user = userEvent.setup();
  render(<QueryClientProvider client={createPortalQueryClient()}><Harness /></QueryClientProvider>);
  return { user, log: () => screen.getByRole("log", { name: "История сообщений" }) };
}

describe("chat store", () => {
  it("creates a conversation, streams a card and continues after approval", async () => {
    signIn();
    let decision: unknown;
    server.use(http.post(url("/chat/conversations/:id/actions/:action"), async ({ request, params }) => {
      decision = { body: await request.json(), action: params.action };
      return sseResponse(streamFixture("stream-approved.txt"), 50);
    }));
    const reply = await useOrbiChat.getState().send("Нужен доступ к Grafana");
    expect(useOrbiChat.getState().conversationId).toBe("conv-1");
    const action = reply?.parts.find((part) => part.type === "action");
    expect(action?.type).toBe("action");
    const actionId = action?.type === "action" ? action.data.id : "";
    const after = await useOrbiChat.getState().decide(actionId, "approve", { level: "write" });
    expect(decision).toEqual({ action: actionId, body: { decision: "approve", edits: { level: "write" } } });
    expect(after?.parts.some((part) => part.type === "request")).toBe(true);
    const card = useOrbiChat.getState().messages.flatMap((message) => message.parts).find((part) => part.type === "action");
    expect(card?.type === "action" && card.data.status).toBe("approved");
  });

  it("ignores empty input and a second send while busy", async () => {
    signIn();
    expect(await useOrbiChat.getState().decide("x", "reject")).toBeUndefined();
    expect(await useOrbiChat.getState().send("   ")).toBeUndefined();
    const first = useOrbiChat.getState().send("Привет");
    expect(await useOrbiChat.getState().send("Ещё")).toBeUndefined();
    await first;
    expect(useOrbiChat.getState().messages.filter((message) => message.role === "user")).toHaveLength(1);
  });

  it("explains rate limits, expired cards and a missing session", async () => {
    signIn();
    server.use(http.post(url("/chat/conversations/:id/messages"), () => problem(429, "RATE_LIMITED")));
    expect((await useOrbiChat.getState().send("Раз"))?.error).toMatch(/Слишком много/);
    server.use(http.post(url("/chat/conversations/:id/actions/:action"), () => problem(409, "ACTION_EXPIRED")));
    expect((await useOrbiChat.getState().decide("a", "approve"))?.error).toMatch(/Карточка устарела/);
    server.use(http.post(url("/chat/conversations/:id/messages"), () => new HttpResponse("x", { status: 500 })));
    expect((await useOrbiChat.getState().send("Два"))?.error).toMatch(/не может ответить/);
    useOrbiChat.getState().startOver();
    server.use(http.post(url("/chat/conversations"), () => problem(401, "NOT_AUTHENTICATED")));
    expect((await useOrbiChat.getState().send("Три"))?.error).toMatch(/Нет связи с Орби/);
  });

  it("loads the latest conversation once and keeps a running one", async () => {
    signIn();
    server.use(
      http.get(url("/chat/conversations"), () => HttpResponse.json([fixture<{ conversation: unknown }>("history.json").conversation])),
      http.get(url("/chat/conversations/:id"), () => HttpResponse.json(fixture("history.json"))),
    );
    await useOrbiChat.getState().load();
    expect(useOrbiChat.getState().messages).toHaveLength(2);
    await useOrbiChat.getState().load();
    expect(useOrbiChat.getState().messages).toHaveLength(2);
    useOrbiChat.getState().clear();
    server.use(http.get(url("/chat/conversations"), () => problem(500, "INTERNAL_ERROR")));
    await useOrbiChat.getState().load();
    expect(useOrbiChat.getState().loaded).toBe(false);
  });

  it("rates answers and opens the companion from a page", async () => {
    signIn();
    let rating: unknown;
    server.use(http.post(url("/chat/messages/:id/feedback"), async ({ request }) => { rating = await request.json(); return new HttpResponse(null, { status: 204 }); }));
    const reply = await useOrbiChat.getState().send("Привет");
    await useOrbiChat.getState().rate(reply?.id ?? "", "up");
    expect(rating).toEqual({ rating: "up" });
    expect(useOrbiChat.getState().messages.at(-1)?.feedback).toBe("up");
    server.use(http.post(url("/chat/messages/:id/feedback"), () => HttpResponse.error()));
    await useOrbiChat.getState().rate(reply?.id ?? "", "down");
    act(() => useOrbiChat.getState().ask("Хочу оформить отгул"));
    expect(useOrbiChat.getState().openSignal).toBe(1);
    await waitFor(() => expect(useOrbiChat.getState().busy).toBe(false));
  });
});

describe("companion chat window", () => {
  it("asks an anonymous visitor to sign in", async () => {
    useSession.setState({ status: "anonymous" });
    renderChat();
    expect(screen.getByRole("link", { name: "Войти" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("textbox", { name: "Сообщение спутнику" })).toBeDisabled();
  });

  it("shows a pending check while the session is restored", () => {
    renderChat();
    expect(screen.getByText("Проверяю, кто ты…")).toBeInTheDocument();
  });

  it("runs the access flow: suggestion, card edits, approval, request card, feedback", async () => {
    signIn();
    let decision: { edits?: Record<string, string> } = {};
    server.use(http.post(url("/chat/conversations/:id/actions/:action"), async ({ request }) => {
      decision = await request.json() as typeof decision;
      return sseResponse(streamFixture("stream-approved.txt"), 64);
    }));
    const { user, log } = renderChat();
    expect(await screen.findByText(/Привет, Аня!/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Нужен доступ к Grafana" }));
    const card = await screen.findByRole("region", { name: "Заявка на доступ: Дашборды Grafana: Объявления" });
    await user.click(within(card).getByRole("button", { name: "Изменить" }));
    await user.selectOptions(within(card).getByRole("combobox", { name: "Уровень" }), "write");
    const justification = within(card).getByRole("textbox", { name: "Обоснование" });
    await user.clear(justification);
    await user.type(justification, "Пушить ветки");
    await user.click(within(card).getByRole("button", { name: "Готово" }));
    expect(within(card).getByText("редактирование")).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Подтвердить" }));
    expect(await within(log()).findByRole("region", { name: "Заявка ACC-1043" })).toBeInTheDocument();
    expect(decision.edits).toEqual({ level: "write", justification: "Пушить ветки" });
    expect(within(card).getByText("Подтверждено")).toBeInTheDocument();
    const thumbs = within(log()).getAllByRole("button", { name: "Полезный ответ" });
    await user.click(thumbs.at(-1)!);
    expect(thumbs.at(-1)).toHaveAttribute("aria-pressed", "true");
  });

  it("rejects a card and starts over", async () => {
    signIn();
    server.use(http.post(url("/chat/conversations/:id/actions/:action"), () => sseResponse(sse(
      { type: "start", messageId: "m2" }, { type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "Хорошо, не отправляю." }, { type: "finish" },
    ))));
    const { user } = renderChat();
    const input = await screen.findByRole("textbox", { name: "Сообщение спутнику" });
    await user.type(input, "Нужен доступ к Grafana{Enter}");
    const card = await screen.findByRole("region", { name: /Заявка на доступ/ });
    await user.click(within(card).getByRole("button", { name: "Отменить" }));
    expect(await screen.findByText("Хорошо, не отправляю.")).toBeInTheDocument();
    expect(within(card).getByText("Отменено")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Новый диалог" }));
    expect(await screen.findByRole("group", { name: "Готовые вопросы" })).toBeInTheDocument();
  });

  it("shows sources, conflicts, an error with retry and reports a conflict", async () => {
    signIn();
    let reported = false;
    server.use(
      http.post(url("/chat/conversations/:id/messages"), () => sseResponse(streamFixture("stream-knowledge.txt"), 200)),
      http.post(url("/knowledge/conflicts/:id/report"), () => {
        reported = true;
        return HttpResponse.json(fixture<object[]>("escalations-kirill.json")[0]);
      }),
    );
    const { user } = renderChat();
    await user.click(await screen.findByRole("button", { name: "Куда отправлять PR?" }));
    expect(await screen.findByText("Инструкции расходятся")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Код-ревью: общий регламент/ }));
    expect(screen.getByText(/Pull request открывается в ветку main/, { selector: "p" })).toBeInTheDocument();
    expect(screen.getAllByText("может устареть").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Уточнить у наставника" }));
    expect(await screen.findByText(/Вопрос передан: Иван Петров/)).toBeInTheDocument();
    expect(reported).toBe(true);
    expect(screen.getByRole("alert")).toHaveTextContent(/не может ответить/);
    server.use(http.post(url("/chat/conversations/:id/messages"), () => sseResponse(sse(
      { type: "start", messageId: "m3", messageMetadata: { mode: "offline" } },
      { type: "text-start", id: "t" }, { type: "text-delta", id: "t", delta: "1. Открой PR в **develop**\n2. Позови `@listings-reviewers` [1]" },
      { type: "data-plan", data: { percent: 16, next_steps: [{ id: "s", title: "Получи ноутбук", due: "2026-11-18", status: "todo", overdue: true }] } },
      { type: "data-equipment", data: { items: [{ kind: "laptop", model: "MacBook", status_title: "в пути", eta: "2026-11-15", pickup_location: "5 этаж", pickup_hours: "10–18" }], meanwhile: [] } },
      { type: "data-escalation", data: { id: "e", assignee: "Иван Петров", level: "mentor", due_at: "2026-11-15T10:00:00Z", status: "open" } },
      { type: "finish" },
    ))));
    await user.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText("офлайн-режим")).toBeInTheDocument();
    expect(screen.getByText("develop").tagName).toBe("STRONG");
    expect(screen.getByRole("region", { name: "Ближайшие шаги" })).toHaveTextContent("Получи ноутбук");
    expect(screen.getByRole("region", { name: "Техника" })).toHaveTextContent("MacBook — в пути");
    expect(screen.getByRole("region", { name: "Вопрос передан" })).toHaveTextContent("Иван Петров");
  });
});
