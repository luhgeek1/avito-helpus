import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App, OrbiCompanion } from "@/_app";
import { IntegrationPage } from "@/_pages/integration";
import { useIntegrationAssistant } from "@/features/integration-assistant";
import { useOrbiChat } from "@/features/orbi-chat";
import { history, resetNavigation, useLocation } from "../portal/navigation";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function renderGuide() {
  resetNavigation("/");
  let observe!: IntersectionObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { observe = callback; }
    observe() {} disconnect = disconnect;
  });
  function Routes() {
    const { pathname } = useLocation();
    return <App>{pathname === "/" ? <IntegrationPage /> : <p>Demo content</p>}</App>;
  }
  const view = render(<Routes />);
  return { ...view, user: userEvent.setup(), observe: (entries: Partial<IntersectionObserverEntry>[]) => act(() => observe(entries as IntersectionObserverEntry[], {} as IntersectionObserver)), disconnect };
}
it("opens a public installation chat on the first visit without an onboarding overlay or login", async () => {
  const { user } = renderGuide();
  expect(screen.getByRole("heading", { name: /Ваша платформа/ })).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "Знакомство с петом" })).not.toBeInTheDocument();
  expect(localStorage.getItem("buddy-onboarding-v1")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Чат" }));
  const chat = screen.getByRole("dialog", { name: "Орби" });
  expect(within(chat).getByText("Помогу установить себя")).toBeInTheDocument();
  await user.click(within(chat).getByRole("button", { name: "С чего начать установку?" }));
  expect(within(chat).getByRole("link", { name: /В руководстве: Запуск/ })).toHaveAttribute("href", "/#quickstart");
  expect(within(chat).getByText(/В корне скопируй/)).toBeInTheDocument();
  const input = within(chat).getByRole("textbox", { name: "Сообщение спутнику" });
  expect(input).toBeEnabled();
  await user.type(input, "API возвращает 502{Enter}");
  expect(within(chat).getByRole("link", { name: /В руководстве: API/ })).toBeInTheDocument();
  expect(useOrbiChat.getState().messages).toEqual([]);
  await user.click(screen.getByRole("button", { name: "Чат" }));
  expect(screen.queryByRole("dialog", { name: "Орби" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Чат" }));
  const reopened = screen.getByRole("dialog", { name: "Орби" });
  expect(within(reopened).getByRole("link", { name: /В руководстве: API/ })).toBeInTheDocument();
  await user.click(within(reopened).getByRole("button", { name: "Новый диалог" }));
  expect(within(reopened).getByText("Помогу установить себя")).toBeInTheDocument();
  const newInput = within(reopened).getByRole("textbox", { name: "Сообщение спутнику" });
  fireEvent.change(newInput, { target: { value: "Как подключить LLM?" } });
  fireEvent.submit(newInput.closest("form")!);
  expect(within(reopened).getByText(/Без LLM_API_KEY/)).toBeInTheDocument();
});

it("opens section-specific help and moves to the selected documentation section", async () => {
  const { user, observe, unmount, disconnect } = renderGuide();
  await user.click(screen.getByRole("button", { name: /Разобрать встраивание с Орби/ }));
  expect(screen.getByRole("dialog", { name: "Орби" })).toBeInTheDocument();
  expect(useIntegrationAssistant.getState().messages.at(-1)?.topics).toContain("react");
  const api = document.getElementById("api")!, start = document.getElementById("quickstart")!;
  observe([{ isIntersecting: true, target: api, boundingClientRect: { top: 200 } as DOMRectReadOnly }, { isIntersecting: true, target: start, boundingClientRect: { top: 100 } as DOMRectReadOnly }]);
  expect(within(screen.getByRole("navigation", { name: "Разделы интеграции" })).getByRole("link", { name: /Запуск проекта/ })).toHaveAttribute("aria-current", "location");
  observe([{ isIntersecting: false, target: api }]);
  await user.click(within(screen.getByRole("navigation", { name: "Разделы интеграции" })).getByRole("link", { name: /Подключение API/ }));
  fireEvent.change(screen.getByRole("combobox", { name: "Перейти к разделу" }), { target: { value: "auth" } });
  expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "instant" });
  expect(window.location.hash).toBe("#auth");
  for (const name of ["Что заменить при внедрении", "API возвращает 502", "Чат просит войти / ошибка 401", "Ответ появляется только целиком"]) {
    await user.click(screen.getByRole("button", { name }));
  }
  await user.click(screen.getAllByRole("button", { name: "Спросить Орби" })[0]);
  await user.click(screen.getAllByRole("button", { name: "Спросить Орби" })[1]);
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});

it("switches between integration and demo without replacing the chosen pet or favorites", async () => {
  localStorage.setItem("buddy-pet", "orbi-neo");
  localStorage.setItem("buddy-favorites", '["orbit","orbi-neo"]');
  localStorage.setItem("buddy-onboarding-v1", "done");
  const { user } = renderGuide();
  fireEvent.keyDown(document.body, { key: "Enter" });
  fireEvent.keyDown(document.body, { key: "Enter" });
  expect(screen.getByRole("dialog", { name: "Запрос к Нео" })).toBeInTheDocument();
  await user.click(within(screen.getByRole("navigation", { name: "Режим сайта" })).getByRole("link", { name: "Демо" }));
  expect(history.location.pathname).toBe("/demo");
  expect(screen.queryByRole("dialog", { name: "Запрос к Нео" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Действия спутника Нео" })).toBeInTheDocument();
  await user.click(within(screen.getByRole("navigation", { name: "Режим сайта" })).getByRole("link", { name: "Интеграция" }));
  expect(history.location.pathname).toBe("/");
  expect(localStorage.getItem("buddy-pet")).toBe("orbi-neo");
  expect(localStorage.getItem("buddy-favorites")).toBe('["orbit","orbi-neo"]');
});

it("provides a standalone companion with the platform as its child", () => {
  localStorage.setItem("buddy-onboarding-v1", "done");
  render(<OrbiCompanion><main>Platform content</main></OrbiCompanion>);
  expect(screen.getByText("Platform content")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Действия спутника Орби" })).toBeInTheDocument();
  expect(localStorage.getItem("buddy-pet")).toBe("orbit");
  expect(screen.queryByRole("navigation", { name: "Разделы портала" })).not.toBeInTheDocument();
});
