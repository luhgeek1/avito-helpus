import { test, expect, loginAsAnya, openChat } from "./fixtures";

const stepTitle = "Получи доступ к репозиторию listings-api";

test("access approval completes the plan step and appears in notifications and requests", async ({ page }) => {
  await loginAsAnya(page);
  await expect(page.getByText(/День 3 стажировки, этап/)).toBeVisible();
  const progress = page.getByRole("progressbar", { name: "Прогресс плана адаптации" });
  await expect(progress).toHaveAttribute("aria-valuenow", /\d+/);
  const before = Number(await progress.getAttribute("aria-valuenow"));
  // The same step can also appear in "Сейчас важно"; use its canonical stage copy.
  const step = page.getByRole("region", { name: "Весь план", exact: true })
    .getByRole("listitem").filter({ has: page.getByRole("heading", { name: stepTitle, exact: true }) });
  await expect(step).toBeVisible();
  await step.getByRole("button", { name: "Сделать с Орби", exact: true }).click();
  const chat = page.getByRole("dialog", { name: "Орби", exact: true });
  const card = chat.getByRole("region", { name: /Заявка на доступ:.*listings-api/ });
  await expect(card).toBeVisible();
  await expect(card.locator("dt")).toContainText(["Ресурс", "Уровень", "Согласует"]);
  await expect(card.locator("dd").nth(0)).toContainText("listings-api");
  await expect(card.locator("dd").nth(1)).toHaveText(/чтение|редактирование/);
  await expect(card.locator("dd").nth(2)).toContainText("Мария Ким");
  await card.getByRole("button", { name: "Подтвердить", exact: true }).click();
  await expect(card.getByText("Подтверждено", { exact: true })).toBeVisible();
  // Navigate while approval is pending; the mock delay must allow this intermediate state.
  await chat.getByRole("button", { name: "Закрыть чат", exact: true }).click();
  await page.getByRole("link", { name: "Заявки", exact: true }).click();
  const request = page.getByRole("listitem").filter({ hasText: "ACC-1042" });
  await expect(request).toContainText("На согласовании");
  await expect(request).toContainText("listings-api");
  await page.getByRole("link", { name: "Мой путь", exact: true }).click();
  await expect(step.getByText("Готово", { exact: true })).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => Number(await progress.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
  await page.getByRole("button", { name: /^Уведомления/ }).click();
  const notices = page.getByRole("dialog", { name: "Уведомления", exact: true });
  await expect(notices.getByRole("link").filter({ hasText: /listings-api.*одобрено/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Заявки", exact: true }).click();
  await expect(request).toContainText("Одобрено");
});

test("PR advice cites sources and exposes conflicting instructions", async ({ page }) => {
  await loginAsAnya(page);
  const chat = await openChat(page);
  await chat.getByRole("textbox", { name: "Сообщение спутнику" }).fill("Куда отправлять PR?");
  await chat.getByRole("button", { name: "Отправить сообщение" }).click();
  await expect(chat.getByText("Источники", { exact: true })).toBeVisible();
  await expect(chat.getByRole("button", { name: /обновлено/ }).first()).toBeVisible();
  const conflict = chat.getByRole("note");
  await expect(conflict.getByText("Инструкции расходятся", { exact: true })).toBeVisible();
  await expect(conflict.getByRole("blockquote")).toHaveCount(2);
  await expect(conflict.getByRole("button", { name: "Уточнить у наставника" })).toBeVisible();
});

test("offline travel question prepares a mentor confirmation card", async ({ page }) => {
  await loginAsAnya(page);
  const chat = await openChat(page);
  await chat.getByRole("textbox", { name: "Сообщение спутнику" }).fill("Как оформить командировку?");
  await chat.getByRole("button", { name: "Отправить сообщение" }).click();
  const card = chat.getByRole("region", { name: /Вопрос: наставник/ });
  await expect(card).toContainText("наставник");
  await expect(card).toContainText("Иван Петров");
  await expect(card).toContainText("Как оформить командировку?");
  await expect(chat.getByText("офлайн-режим", { exact: true })).toBeVisible();
});

test("mobile chat send button receives a real click above the companion", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAsAnya(page);
  const chat = await openChat(page);
  await chat.getByRole("textbox", { name: "Сообщение спутнику" }).fill("Куда отправлять PR?");
  const send = chat.getByRole("button", { name: "Отправить сообщение" });
  await expect(send).toBeInViewport();
  // No force: Playwright checks that the companion does not intercept pointer events.
  await send.click();
  await expect(chat.getByText("Источники", { exact: true })).toBeVisible();
});
