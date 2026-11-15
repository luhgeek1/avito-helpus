import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test as base, expect } from "playwright/test";
import type { Page } from "playwright/test";

const execute = promisify(execFile);
const root = fileURLToPath(new URL("../../", import.meta.url));

// This suite owns a disposable local Compose stack, never a shared deployment.
export const test = base.extend({
  page: async ({ page, baseURL, request }, use) => {
    const url = new URL(baseURL!);
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)) {
      throw new Error("E2E requires a disposable local Compose stack over HTTP");
    }
    await execute(process.env.E2E_PYTHON ?? "python", ["deploy/reset_demo.py"], {
      cwd: root, timeout: 120_000,
    });
    for (const path of ["/healthz", "/api/health"]) {
      await expect.poll(async () => {
        try {
          const response = await request.get(path, { timeout: 5_000 });
          return response.ok() && (await response.json()).status === "ok";
        } catch { return false; }
      }, { timeout: 60_000, message: `Waiting for nginx ${path} after demo reset` }).toBe(true);
    }
    await use(page);
  },
});

export { expect };

export async function loginAsAnya(page: Page) {
  await page.goto("/login");
  const tour = page.getByRole("dialog", { name: "Знакомство с петом" });
  await expect(tour).toBeVisible();
  await tour.getByRole("button", { name: "Пропустить", exact: true }).click();
  await expect(tour).toBeHidden();
  await page.getByRole("region", { name: "Войти как" })
    .getByRole("button", { name: /Аня Смирнова/ }).click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByRole("heading", { name: "Мой путь", exact: true })).toBeVisible();
}

export async function openChat(page: Page) {
  await page.getByRole("button", { name: "Действия спутника Орби", exact: true }).click();
  await page.getByRole("button", { name: "Чат", exact: true }).click();
  const chat = page.getByRole("dialog", { name: "Орби", exact: true });
  await expect(chat).toBeVisible();
  return chat;
}
