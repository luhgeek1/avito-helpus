import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "@/_app";
import { PetGalleryPage } from "@/_pages/pet-gallery";
import { useOrbiChat } from "@/features/orbi-chat";
import { useOrbiNotice } from "@/shared/api";
import { resetNavigation } from "../portal/navigation";
import { signIn } from "../orbi/server";

function renderApp(path = "/", page = <p>Страница</p>, { tour = false } = {}) {
  if (!tour) {
    localStorage.setItem("buddy-onboarding-v1", "done");
    localStorage.setItem("buddy-pet", "orbit");
  }
  resetNavigation(path);
  const user = userEvent.setup();
  render(<App>{page}</App>);
  return { user, pet: () => screen.getByRole("button", { name: /^Действия спутника/ }) };
}

describe("companion", () => {
  it("introduces itself on the first visit and can be skipped", async () => {
    const { user } = renderApp("/", <p>Страница</p>, { tour: true });
    const tour = await screen.findByRole("dialog", { name: "Знакомство с петом" });
    expect(within(tour).getAllByText(/Привет! Я Орби/).length).toBeGreaterThan(0);
    await user.click(within(tour).getByRole("button", { name: "Пропустить" }));
    await waitFor(() => expect(localStorage.getItem("buddy-onboarding-v1")).toBe("done"), { timeout: 3000 });
  });

  it("opens the menu, the chat, the wardrobe and the settings", async () => {
    signIn();
    const { user, pet } = renderApp();
    await screen.findByText("Страница");
    await user.click(pet());
    const menu = screen.getByRole("group", { name: "Действия спутника" });
    await user.click(within(menu).getByRole("button", { name: "Чат" }));
    const chat = await screen.findByRole("dialog", { name: "Орби" });
    expect(await within(chat).findByRole("group", { name: "Готовые вопросы" })).toBeInTheDocument();
    await user.click(within(chat).getByRole("button", { name: "Назад к меню пета" }));
    await user.click(within(screen.getByRole("group", { name: "Действия спутника" })).getByRole("button", { name: "Гардероб" }));
    const wardrobe = screen.getByRole("region", { name: "Гардероб спутника" });
    const options = within(wardrobe).getAllByRole("button", { name: /Выбрать персонажа/ });
    await user.click(options[2]);
    fireEvent.keyDown(wardrobe, { key: "ArrowRight" });
    fireEvent.wheel(wardrobe, { deltaY: 120 });
    await user.click(pet());
    await user.click(within(screen.getByRole("group", { name: "Действия спутника" })).getByRole("button", { name: "Настройки" }));
    const settings = screen.getByRole("dialog", { name: "Настройки спутника" });
    await user.click(within(settings).getByRole("button", { name: "Закрыть настройки" }));
    await user.keyboard("{Escape}");
  });

  it("opens the chat when a page asks Orbi and speaks live notifications", async () => {
    signIn();
    renderApp();
    await screen.findByText("Страница");
    act(() => useOrbiChat.getState().ask("Что мне делать дальше?"));
    const chat = await screen.findByRole("dialog", { name: "Орби" });
    expect(await within(chat).findByRole("region", { name: /Заявка на доступ/ })).toBeInTheDocument();
    await userEvent.click(within(chat).getByRole("button", { name: "Закрыть чат" }));
    act(() => useOrbiNotice.getState().show({ id: "n1", title: "Доступ к Jira: одобрено", body: "Шаг плана закрыт", link: "/plan" }));
    expect(await screen.findByRole("button", { name: "Закрыть ответ" })).toBeInTheDocument();
    expect(screen.getByText(/Доступ к Jira: одобрено/, { selector: "span.absolute" })).toBeInTheDocument();
    const reveal = screen.queryByRole("button", { name: "Показать сразу" });
    if (reveal) await userEvent.click(reveal);
    await userEvent.click(screen.getByRole("button", { name: "Закрыть ответ" }));
    expect(screen.queryByRole("button", { name: "Закрыть ответ" })).not.toBeInTheDocument();
  });

  it("answers from Spotlight: short text in the pixel dialogue, cards in the chat", async () => {
    signIn();
    const { user } = renderApp();
    await screen.findByText("Страница");
    fireEvent.keyDown(document.body, { key: "Enter" });
    fireEvent.keyDown(document.body, { key: "Enter" });
    const spotlight = await screen.findByRole("dialog", { name: "Запрос к Орби" });
    await user.type(within(spotlight).getByRole("textbox", { name: "Запрос для пета" }), "Нужен доступ к Grafana");
    await user.click(within(spotlight).getByRole("button", { name: "Отправить запрос" }));
    expect(await screen.findByRole("dialog", { name: "Орби" }, { timeout: 3000 })).toBeInTheDocument();
  });

  it("asks an anonymous visitor to sign in from Spotlight and can hide itself", async () => {
    const { user, pet } = renderApp();
    await screen.findByText("Страница");
    fireEvent.keyDown(document.body, { key: "Enter" });
    fireEvent.keyDown(document.body, { key: "Enter" });
    const spotlight = await screen.findByRole("dialog", { name: "Запрос к Орби" });
    await user.type(within(spotlight).getByRole("textbox", { name: "Запрос для пета" }), "Привет{Enter}");
    expect(await screen.findByText(/Сначала войди в Хаб/, { selector: "span.absolute" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.dblClick(pet());
    await user.click(screen.getByRole("button", { name: "Скрыть спутника" }));
    await user.click(await screen.findByRole("button", { name: /рядом/ }));
    expect(pet()).toBeInTheDocument();
  });
});

describe("pet gallery", () => {
  it("filters, previews, likes and chooses a companion", async () => {
    const { user } = renderApp("/pets", <PetGalleryPage requestedId="orbit" />);
    const collection = await screen.findByRole("region", { name: "Коллекция петов" });
    for (const label of [/^Раньше/, /^Все/, /^Орби/]) await user.click(within(collection).getByRole("button", { name: label }));
    await user.click(within(collection).getAllByRole("button", { name: /^В избранное/ })[0]);
    await user.click(within(collection).getByRole("button", { name: /^Избранные · 1/ }));
    await user.click(within(collection).getByRole("button", { name: "Приостановить анимацию" }));
    await user.click(within(collection).getByRole("button", { name: "Включить анимацию" }));
    await user.click(within(collection).getByRole("button", { name: /^Все/ }));
    await user.click(within(collection).getAllByRole("button", { name: /^Рассмотреть/ })[5]);
    const inspector = screen.getByLabelText("Знакомство с выбранным петом");
    for (const scale of within(inspector).getAllByRole("button", { name: /^Масштаб/ })) await user.click(scale);
    await user.click(within(inspector).getByRole("button", { name: /Выбрать бадди/ }));
    expect(localStorage.getItem("buddy-pet")).not.toBe("orbit");
    expect(JSON.parse(localStorage.getItem("buddy-favorites") ?? "[]")).toHaveLength(1);
  });
});
