import { chromium, expect } from 'playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const output = fileURLToPath(new URL('../../../design/captures/sdk/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [app, port] of [['vite', 5184], ['next', 5185]]) {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${port}`);
      const chat = page.getByRole('button', { name: 'Чат', exact: true });
      await expect(chat).toBeVisible();
      const before = app === 'vite' ? await page.locator('#host-button').evaluate((el) => getComputedStyle(el).cssText + getComputedStyle(el).backgroundColor) : '';
      await chat.click();
      await page.getByRole('textbox', { name: 'Сообщение спутнику' }).fill('Как установить npm библиотеку?');
      await page.getByRole('button', { name: 'Отправить сообщение', exact: true }).click();
      await expect(page.getByText(/Библиотека @orbi-companion/)).toBeVisible();
      await chat.click(); await expect(page.locator('.companion-chat')).toHaveCount(0);
      await chat.click(); await expect(page.getByText(/Библиотека @orbi-companion/)).toBeVisible();
      const rect = await page.locator('.companion-chat').boundingBox();
      if (rect.x < 0 || rect.x + rect.width > width) throw new Error('Chat exceeds viewport');
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${output}/${app}-${width}.png` });
      await chat.click();
      await page.locator('h1').click(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
      await expect(page.getByRole('textbox', { name: 'Запрос для пета' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.companion-spotlight')).toHaveCount(0);
      await page.locator('.widget-pet').click();
      await page.getByRole('button', { name: 'Гардероб', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Гардероб спутника' })).toBeVisible();
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('Escape');
      // Keyboard activation avoids a deliberate double-click greeting.
      await page.locator('.widget-pet').press('Enter');
      await page.getByRole('button', { name: 'Настройки', exact: true }).click();
      await page.getByRole('switch', { name: /Анимация/ }).click();
      await expect(page.getByRole('switch', { name: /Анимация/ })).toHaveAttribute('aria-checked', 'false');
      await page.getByRole('button', { name: 'Закрыть настройки' }).click();
      if (app === 'vite') {
        expect(await page.locator('#host-button').evaluate((el) => getComputedStyle(el).cssText + getComputedStyle(el).backgroundColor)).toBe(before);
        await page.getByRole('textbox', { name: 'Поле приложения' }).focus();
        await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
        await expect(page.locator('.companion-spotlight')).toHaveCount(0);
        await page.locator('#host-button').click(); await expect(page.locator('[data-orbi-sdk]')).toHaveCount(0);
        await page.locator('#host-button').click(); await expect(chat).toBeVisible();
      }
      expect(errors).toEqual([]);
      results.push({ app, width, chatToggle: true, spotlight: true, wardrobe: true, settings: true, errors });
      await page.close();
    }
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await page.goto('http://127.0.0.1:5184/?tour');
  await expect(page.getByRole('dialog', { name: 'Знакомство с петом' })).toBeVisible();
  await page.getByRole('button', { name: 'Пропустить', exact: true }).click();
  await page.goto('http://127.0.0.1:5184/?connected');
  await page.getByRole('button', { name: 'Чат', exact: true }).click();
  await page.getByRole('link', { name: 'Войти', exact: true }).click();
  await page.getByLabel('Рабочая почта').fill('anya.intern@buddy.test');
  await page.getByLabel('Пароль', { exact: true }).fill('orbi-demo-2026');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Войти в Орби' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Чат', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Сообщение спутнику' });
  await expect(input).toBeEnabled();
  await input.fill('Как установить библиотеку Орби?'); await input.press('Enter');
  await expect(page.getByText('Установка библиотеки Орби', { exact: true }).first()).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${output}/imported-knowledge.png` });
  await page.getByRole('button', { name: 'Новый диалог', exact: true }).click();
  await input.fill('Нужен доступ к listings-api'); await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Подтвердить', exact: true })).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: `${output}/confirmation.png` });
  await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await expect(page.getByText('Подтверждено', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Чат', exact: true }).click();
  await expect(page.locator('.pixel-dialogue')).toContainText(/одобрено/i, { timeout: 20000 });
  await page.screenshot({ path: `${output}/notification.png` });
  results.push({ liveBackend: true, knowledgeImport: true, mcpConfirmation: true, terminalApproved: true, sseNotification: true, tour: true });
  await page.close();
} finally {
  await browser.close();
  await writeFile(`${output}/verification.json`, JSON.stringify({ results }, null, 2));
}
console.log(JSON.stringify(results, null, 2));
