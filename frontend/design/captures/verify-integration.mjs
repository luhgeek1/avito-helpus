import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { rename, writeFile } from 'node:fs/promises';

const root = new URL('./', import.meta.url).pathname;
const base = process.env.VERIFY_URL ?? 'http://127.0.0.1:5173';
const browser = await chromium.launch();
const errors = [], results = [];

async function settle(page) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => {
    const iterations = animation.effect?.getTiming().iterations;
    return iterations !== Infinity;
  }).map(animation => animation.finished.catch(() => {}))));
}

try {
  for (const [width, height] of [[1440, 900], [1366, 768], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height },
      permissions: ['clipboard-read', 'clipboard-write'],
      ...(width !== 1366 ? { recordVideo: { dir: root, size: { width, height } } } : {}),
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push({ width, message: error.message }));
    const chatRequests = [];
    page.on('request', request => { if (request.url().includes('/api/v1/chat/')) chatRequests.push(request.url()); });
    await page.goto(base, { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: /Ваша платформа/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Действия спутника Орби' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Знакомство с петом' })).toHaveCount(0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await settle(page);
    await page.screenshot({ path: `${root}integration-${width}.png` });

    const copy = page.getByRole('button', { name: 'Скопировать код: Ваш постоянный layout', exact: true });
    await copy.click();
    await expect(copy).toHaveText('Скопировано');
    assert((await page.evaluate(() => navigator.clipboard.readText())).includes('OrbiCompanion'));

    await page.getByRole('button', { name: 'Чат', exact: true }).click();
    const chat = page.getByRole('dialog', { name: 'Орби', exact: true });
    await expect(chat.getByText('Помогу установить себя')).toBeVisible();
    await chat.getByRole('button', { name: 'Как встроить в Next.js?' }).click();
    await expect(chat.getByRole('link', { name: /В руководстве: Встраивание/ })).toHaveCount(1);
    await settle(page);
    await page.screenshot({ path: `${root}integration-chat-${width}.png` });
    const bubble = page.getByRole('button', { name: 'Чат', exact: true });
    await bubble.click();
    await expect(chat).toHaveCount(0);
    await expect(bubble).toHaveAttribute('title', 'Открыть чат');
    await page.screenshot({ path: `${root}chat-toggle-closed-${width}.png` });
    await bubble.click();
    await expect(chat.getByRole('link', { name: /В руководстве: Встраивание/ })).toHaveCount(1);
    await expect(bubble).toHaveAttribute('title', 'Закрыть чат');
    const input = chat.getByRole('textbox', { name: 'Сообщение спутнику' });
    await input.fill('API возвращает 502. Что проверить?');
    await input.press('Enter');
    await expect(chat.locator('[data-role=assistant]').last()).toContainText('При 502');
    await chat.getByRole('button', { name: 'Новый диалог' }).click();
    await input.fill('Что завтра на обед?');
    await chat.getByRole('button', { name: 'Отправить сообщение' }).click();
    await expect(chat.locator('[data-role=assistant]').last()).toContainText('нет точного ответа');
    assert.equal(chatRequests.length, 0, 'The documentation helper must not use a private conversation API');
    await chat.getByRole('button', { name: 'Закрыть чат' }).click();

    // Every section remains readable going down and back, including local horizontal code scroll.
    for (const section of ['quickstart', 'react', 'api', 'auth', 'services', 'check', 'services', 'auth', 'api', 'react', 'quickstart', 'overview']) {
      await page.locator(`#${section}`).scrollIntoViewIfNeeded();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.evaluate(() => scrollTo(0, 0));
    if (width === 390) {
      await page.getByRole('combobox', { name: 'Перейти к разделу' }).selectOption('api');
      assert.equal(new URL(page.url()).hash, '#api');
      await page.evaluate(() => scrollTo(0, 0));
    }
    // Preserve user preferences across the real Next.js route transition.
    await page.evaluate(() => localStorage.setItem('buddy-favorites', '["orbit","orbi-neo"]'));
    await page.getByRole('navigation', { name: 'Режим сайта' }).getByRole('link', { name: 'Демо', exact: true }).click();
    await expect(page).toHaveURL(/\/demo$/);
    const tour = page.getByRole('dialog', { name: 'Знакомство с петом' });
    await expect(tour).toBeVisible();
    await tour.getByRole('button', { name: 'Пропустить', exact: true }).click();
    await expect(tour).toBeHidden();
    await expect(page.getByRole('heading', { name: /Хорошего дня в Авито/ })).toBeVisible();
    const survey = page.getByRole('button', { name: 'Закрыть опрос', exact: true });
    if (await survey.isVisible()) await survey.click();
    await settle(page);
    if (width !== 1366) await page.screenshot({ path: `${root}integration-demo-${width}.png` });
    await page.getByRole('button', { name: 'Чат', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Орби', exact: true }).getByRole('link', { name: 'Войти', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Чат', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Орби', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'На главную', exact: true }).click();
    await expect(page).toHaveURL(/\/demo$/);
    await page.getByRole('navigation', { name: 'Режим сайта' }).getByRole('link', { name: 'Интеграция', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    assert.deepEqual(await page.evaluate(() => ({ pet: localStorage.getItem('buddy-pet'), favorites: localStorage.getItem('buddy-favorites') })),
      { pet: 'orbit', favorites: '["orbit","orbi-neo"]' });
    await page.getByRole('button', { name: 'Чат', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Орби', exact: true }).locator('[data-role=assistant]').last()).toContainText('нет точного ответа');
    await page.getByRole('dialog', { name: 'Орби', exact: true }).getByRole('button', { name: 'Закрыть чат' }).click();
    // Keyboard access to the page and a reduced-motion pass.
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'К содержимому', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Чат', exact: true }).click();
    assert.equal(await page.locator('.companion-chat').evaluate(element => getComputedStyle(element).animationName), 'none');
    const bounds = await page.locator('.companion-chat').boundingBox();
    assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height);
    await page.getByRole('button', { name: 'Чат', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Орби', exact: true })).toHaveCount(0);
    results.push({ width, height, overflow: false, copy: true, guideChat: true, noPrivateChatRequests: true,
      demoAndBack: true, chatToggle: true, preservedPreferences: true, firstVisitTourOnlyInDemo: true, keyboard: true, reducedMotion: true });
    const video = page.video();
    await context.close();
    if (video) await rename(await video.path(), `${root}integration-${width}.webm`);
  }
  assert.deepEqual(errors, []);
  await writeFile(`${root}integration-verification.json`, JSON.stringify({ results, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ results, errors }, null, 2));
} finally { await browser.close(); }
