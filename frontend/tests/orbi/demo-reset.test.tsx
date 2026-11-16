import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import { DemoResetButton } from "@/features/demo-reset";
import { useSession } from "@/shared/api";
import { history, resetNavigation } from "../portal/navigation";
import { server } from "../portal/setup";
import { problem, signIn, url } from "./server";

afterEach(() => { vi.useRealTimers(); });

const button = () => screen.getByRole("button", { name: /демо|сбросить|Сбрасываю|Не получилось/i });

it("asks once more, resets the demo, signs out and opens the login screen", async () => {
  resetNavigation("/demo");
  signIn();
  let calls = 0;
  server.use(http.post(url("/demo/reset"), () => { calls += 1; return HttpResponse.json({ status: "reset" }); }));
  render(<DemoResetButton />);

  fireEvent.click(button());
  expect(button()).toHaveAccessibleName("Точно сбросить?");
  expect(calls).toBe(0);
  fireEvent.click(button());

  await waitFor(() => expect(history.location.pathname).toBe("/login"));
  expect(calls).toBe(1);
  expect(useSession.getState().status).toBe("anonymous");
  expect(button()).toHaveAccessibleName("Сбросить демо");
});

it("explains a stand where the public reset is switched off", async () => {
  server.use(http.post(url("/demo/reset"), () => problem(404, "NOT_FOUND", "Не найдено")));
  render(<DemoResetButton />);

  fireEvent.click(button());
  fireEvent.click(button());

  await waitFor(() => expect(button()).toHaveAccessibleName("Не получилось"));
  expect(screen.getByRole("status")).toHaveTextContent("Сброс выключен на этом стенде");
  expect(button()).toHaveAttribute("title", "Сброс выключен на этом стенде");
  // A further click starts a new confirmation instead of resetting straight away.
  fireEvent.click(button());
  expect(button()).toHaveAccessibleName("Точно сбросить?");
});

it("shows the server's own reason for other failures", async () => {
  server.use(http.post(url("/demo/reset"), () => problem(429, "RATE_LIMITED", "Слишком много запросов, попробуй через минуту")));
  render(<DemoResetButton />);

  fireEvent.click(button());
  fireEvent.click(button());

  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Слишком много запросов"));
});

it("drops an unconfirmed reset after five seconds", () => {
  vi.useFakeTimers();
  render(<DemoResetButton />);

  fireEvent.click(button());
  expect(button()).toHaveAccessibleName("Точно сбросить?");
  act(() => { vi.advanceTimersByTime(5000); });

  expect(button()).toHaveAccessibleName("Сбросить демо");
});
