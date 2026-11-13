const baseURL = process.env.PET_TEST_URL ?? 'http://localhost:5173';
import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch();
const errors = [], results = [];
try {
  for (const width of [1440, 1366, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 650 });
    await context.addInitScript(() => {
      localStorage.setItem("buddy-onboarding-v1", "done");
      if (localStorage.getItem('chat-test')) return;
      localStorage.setItem('chat-test', 'true');
      localStorage.setItem('buddy-pet', 'orbit');
      localStorage.setItem('buddy-favorites', '["orbit","orbi-neo"]');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL + '/', { waitUntil: 'networkidle' });
    const pet = page.locator('.widget-pet');
    const chat = page.getByRole('dialog', { name: 'Орби', exact: true });
    const input = page.getByRole('textbox', { name: 'Сообщение спутнику' });
    const send = page.getByRole('button', { name: 'Отправить сообщение' });
    async function open() {
      await page.waitForTimeout(400);
      await pet.click();
      await page.getByRole('button', { name: 'Чат', exact: true }).click();
      await chat.waitFor();
      await page.waitForTimeout(300);
    }
    async function checkBounds() {
      const b = await chat.boundingBox();
      const viewport = page.viewportSize();
      assert(b.x >= 8 && b.y >= 8 && b.x + b.width <= viewport.width - 8 && b.y + b.height <= viewport.height - 8, JSON.stringify(b));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await open();
    await checkBounds();
    const c = await chat.boundingBox(), p = await pet.boundingBox();
    assert(c.y + c.height < p.y, 'Chat should open above the pet');
    assert.equal(await page.locator('.pixel-dialogue').count(), 0);
    assert.equal(await page.locator('#companion-actions').getAttribute('aria-hidden'), 'true');
    assert.equal(await chat.locator('article').count(), 5);
    assert(await send.isDisabled());
    await page.screenshot({ path: `frontend/design/captures/companion-chat-${width}.png` });
    await input.fill('   '); assert(await send.isDisabled());
    await input.fill('Нужен доступ к сервису');
    await input.press('Enter');
    assert.equal(await chat.locator('article').count(), 7);
    assert.equal(await input.inputValue(), '');
    assert.match(await chat.locator('article').last().innerText(), /к какому сервису/);
    await input.fill('Первая строка'); await input.press('Shift+Enter');
    await input.press('a'); assert.equal(await input.inputValue(), 'Первая строка\na');
    assert.equal(await chat.locator('article').count(), 7);
    await send.click(); assert.equal(await chat.locator('article').count(), 9);
    await input.fill('Спасибо');
    await input.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true })));
    assert.equal(await chat.locator('article').count(), 9);
    await send.click(); assert.equal(await chat.locator('article').count(), 11);
    await input.fill('Длинноеслово'.repeat(90)); await send.click(); await checkBounds();
    assert.equal(await chat.locator('article').count(), 13);
    await page.screenshot({ path: `frontend/design/captures/companion-chat-sent-${width}.png` });
    const log = page.getByRole('log', { name: 'История сообщений' });
    assert(await log.evaluate(element => element.scrollHeight > element.clientHeight));
    assert(await log.evaluate(element => Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) < 3));
    await log.evaluate(element => { element.scrollTop = 0; });
    assert(await chat.getByText('Начало диалога', { exact: true }).isVisible());
    await input.fill('Черновик');
    await page.getByRole('button', { name: 'Закрыть чат' }).click();
    assert.equal(await pet.evaluate(element => element === document.activeElement), true);
    await open(); assert.equal(await input.inputValue(), 'Черновик');
    assert.equal(await chat.locator('article').count(), 13);
    await input.fill('');
    await page.reload({ waitUntil: 'networkidle' });
    await open(); assert.equal(await chat.locator('article').count(), 13);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('buddy-favorites'))), ['orbit', 'orbi-neo']);
    assert.equal(await page.evaluate(() => localStorage.getItem('buddy-pet')), 'orbit');
    await page.keyboard.press('Escape'); assert.equal(await chat.count(), 0);
    assert.equal(await pet.evaluate(element => element === document.activeElement), true);
    await open(); await page.mouse.click(20, 150); assert.equal(await chat.count(), 0);
    await page.goto(baseURL + '/pets', { waitUntil: 'networkidle' });
    await open(); assert.equal(await chat.locator('article').count(), 13); await page.keyboard.press('Escape');
    const box = await pet.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(width / 2, 55, { steps: 10 }); await page.mouse.up();
    await open(); await checkBounds();
    await page.screenshot({ path: `frontend/design/captures/companion-chat-edge-${width}.png` });
    await page.setViewportSize({ width, height: 400 });
    await page.waitForFunction(() => { const b = document.querySelector('#companion-chat')?.getBoundingClientRect(); return b && b.top >= 8 && b.bottom <= innerHeight - 8; });
    await checkBounds();
    await page.screenshot({ path: `frontend/design/captures/companion-chat-short-${width}.png` });
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open();
    assert.equal(await chat.evaluate(element => getComputedStyle(element).animationName), 'none');
    results.push({ width, initialMessages: 5, savedMessages: 13, enter: true, shiftEnter: true, ime: true,
      sendButton: true, scrollHistory: true, persistence: true, draft: true, edgePlacement: true,
      shortViewport: true, favoritesPreserved: true, reducedMotion: true });
    await context.close();
  }
  for (const mode of ['corrupt', 'disabled']) {
    const context = await browser.newContext();
    await context.addInitScript(mode => {
      localStorage.setItem("buddy-onboarding-v1", "done");
      localStorage.setItem('buddy-pet', 'orbit');
      localStorage.setItem('buddy-chat', '{broken');
      if (mode === 'disabled') {
        const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
        Storage.prototype.getItem = function(key) { if (key === 'buddy-chat') throw new Error('Unavailable'); return get.call(this, key); };
        Storage.prototype.setItem = function(key, value) { if (key === 'buddy-chat') throw new Error('Unavailable'); return set.call(this, key, value); };
      }
    }, mode);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL + '/', { waitUntil: 'networkidle' });
    await page.locator('.widget-pet').click(); await page.getByRole('button', { name: 'Чат', exact: true }).click();
    await page.getByRole('textbox').fill('Привет'); await page.getByRole('button', { name: 'Отправить сообщение' }).click();
    assert.equal(await page.locator('.companion-chat article').count(), 7);
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile('frontend/design/captures/companion-chat-verification.json', JSON.stringify({ results, storageFallbacks: true, errors }, null, 2));
  console.log('PASS chat: above-pet layout, mocks, send, history, persistence, keyboard, IME, scroll, edges, short viewport, reduced motion, storage fallbacks');
} finally { await browser.close(); }
