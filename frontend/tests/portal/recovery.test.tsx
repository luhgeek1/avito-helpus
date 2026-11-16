import { act, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import { renderApp, screen } from "./render";
import { server } from "./setup";
import { IllustrationsPage } from "@/_pages/portal";
import { render } from "@testing-library/react";
import { api } from "@/shared/api";
import { z } from "zod";

afterEach(() => vi.restoreAllMocks());

it.each([
  ["/demo", "/api/quick-actions"], ["/demo", "/api/birthdays"], ["/demo", "/api/services"],
  ["/demo", "/api/benefits"], ["/demo", "/api/posts"], ["/demo", "/api/channels"],
  ["/events", "/api/events"], ["/feed", "/api/posts"], ["/feed/post-1", "/api/posts/post-1"],
  ["/benefits/savings", "/api/benefits/savings"], ["/services", "/api/services"], ["/services/it", "/api/services/it"],
  ["/search?q=Авито", "/api/search"], ["/profile", "/api/me"], ["/profile", "/api/calendar"],
])("recovers %s after a failed request to %s", async (path, endpoint) => {
  server.use(http.get(endpoint, () => new HttpResponse(null, { status: 500 }), { once: true }));
  const { user } = renderApp(path);
  // Slow CI runners need more than the default second before the failed query surfaces.
  const alert = await screen.findByRole("alert", undefined, { timeout: 5000 });
  await user.click(within(alert).getByRole("button", { name: "Повторить" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
});

it("likes a feed card and updates the cached list", async () => {
  const { user } = renderApp("/feed");
  const button = (await screen.findAllByRole("button", { name: "Поставить лайк" }))[0];
  await user.click(button);
  await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "true"));
  await user.click(button);
  await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "false"));
});

it("subscribes to the digest and can undo the subscription", async () => {
  const { user } = renderApp("/demo");
  await user.click(await screen.findByRole("button", { name: "Подписаться на дайджест" }));
  expect(screen.getByRole("button", { name: "Отписаться от дайджеста" })).toHaveAttribute("aria-pressed", "true");
  await user.click(screen.getByRole("button", { name: "Отписаться от дайджеста" }));
  expect(screen.getByRole("button", { name: "Подписаться на дайджест" })).toHaveAttribute("aria-pressed", "false");
});

it("records a negative portal feedback answer", async () => {
  const { user } = renderApp("/demo");
  await user.click(await screen.findByRole("button", { name: "Не нравится" }));
  expect(await screen.findByText("Спасибо! Учтём ваш ответ")).toBeInTheDocument();
});

it("retries failed portal feedback", async () => {
  server.use(http.post("/api/feedback", () => new HttpResponse(null, { status: 500 }), { once: true }));
  const { user } = renderApp("/demo");
  const dialog = await screen.findByRole("dialog", { name: "Опрос о портале" });
  await user.click(within(dialog).getByRole("button", { name: "Нравится" }));
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Нравится" })).toBeEnabled());
  await user.click(within(dialog).getByRole("button", { name: "Нравится" }));
  expect(await screen.findByText("Спасибо! Учтём ваш ответ")).toBeInTheDocument();
});

it("shows calendar day mode and handles unavailable clipboard", async () => {
  const { user } = renderApp("/profile");
  const calendar = await screen.findByRole("region", { name: "Календарь" });
  await user.click(within(calendar).getByRole("button", { name: "Неделя" }));
  await user.click(within(calendar).getByRole("button", { name: "День" }));
  expect(within(calendar).getByRole("button", { name: "День" })).toHaveAttribute("aria-pressed", "true");
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
  await user.click(await screen.findByRole("button", { name: "Скопировать логин" }));
  expect(screen.queryByText("Скопировано")).not.toBeInTheDocument();
  expect(await screen.findByText("Не скопировалось")).toBeInTheDocument();
});

it("explains that messenger and calls are not connected in the demo", async () => {
  const { user } = renderApp("/profile");
  await user.click(await screen.findByRole("button", { name: "Написать в мессенджер" }));
  expect(screen.getByRole("status")).toHaveTextContent("Мессенджер и звонки в демо-портале не подключены");
  await user.click(screen.getByRole("button", { name: "Позвонить" }));
  expect(screen.getByRole("status")).toHaveTextContent("Звонки в демо-портале не подключены");
  await user.click(screen.getByRole("button", { name: "Созвониться по видео" }));
  expect(screen.getByRole("status")).toHaveTextContent("Видеозвонки в демо-портале не подключены");
});

it("cancels the copied-label timer when leaving the profile", async () => {
  const schedule = vi.spyOn(globalThis, "setTimeout");
  const cancel = vi.spyOn(globalThis, "clearTimeout");
  const { user, unmount } = renderApp("/profile");
  await user.click(await screen.findByRole("button", { name: "Скопировать логин" }));
  expect(await screen.findByText("Скопировано")).toBeInTheDocument();
  const timerIndex = schedule.mock.calls.findIndex((args) => args[1] === 1500);
  expect(timerIndex).toBeGreaterThanOrEqual(0);
  const timer = schedule.mock.results[timerIndex].value;
  unmount();
  expect(cancel).toHaveBeenCalledWith(timer);
});

it("does not schedule a copied-label timer after a late clipboard reply to an unmounted profile", async () => {
  const { user, unmount } = renderApp("/profile");
  let finish!: () => void;
  vi.spyOn(navigator.clipboard, "writeText").mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
  await user.click(await screen.findByRole("button", { name: "Скопировать логин" }));
  unmount();
  const schedule = vi.spyOn(globalThis, "setTimeout");
  await act(async () => finish());
  expect(schedule.mock.calls.some((args) => args[1] === 1500)).toBe(false);
});

it("shows the illustration catalog across palettes and small sizes", () => {
  render(<IllustrationsPage />);
  const catalog = screen.getByRole("region", { name: "Все иллюстрации" });
  const palettes = screen.getByRole("region", { name: "На палитрах" });
  const sizes = screen.getByRole("region", { name: "Мелкие размеры" });
  expect(catalog.querySelectorAll("figure")).toHaveLength(60);
  expect(palettes.querySelectorAll("img")).toHaveLength(300);
  expect(sizes.querySelectorAll("img")).toHaveLength(120);
});

it("finds a post by its lead text", async () => {
  const posts = await api.get("/posts", z.array(z.object({ lead: z.string(), id: z.string() })));
  const lead = posts[0].lead;
  const results = await api.get(`/search?q=${encodeURIComponent(lead)}`, z.array(z.object({ type: z.string(), id: z.string() })));
  expect(results).toContainEqual({ type: "post", id: posts[0].id });
});
