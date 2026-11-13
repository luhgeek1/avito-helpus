import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs');
const base = process.env.PET_TEST_URL ?? 'http://localhost:5173';
const browser = await chromium.launch();
const errors = [], results = [];
try {
  for (const width of [1440, 1366, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 650 });
    await context.addInitScript(() => {
      localStorage.setItem('buddy-onboarding-v1', 'done');
      localStorage.setItem('buddy-pet', 'orbit');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(base, { waitUntil: 'networkidle' });
    const chat = page.getByRole('dialog', { name: 'Орби', exact: true });
    const corner = page.getByRole('button', { name: 'Изменить размер чата', exact: true });
    const input = page.getByRole('textbox', { name: 'Сообщение спутнику' });
    async function open() {
      await page.waitForTimeout(400);
      await page.locator('.widget-pet').click();
      await page.getByRole('button', { name: 'Чат', exact: true }).click();
      await chat.waitFor();
      await page.waitForTimeout(200);
    }
    async function bounds() {
      const b = await chat.boundingBox(), viewport = page.viewportSize();
      assert(b.x >= 12 && b.y >= 12 && b.x + b.width <= viewport.width - 12 && b.y + b.height <= viewport.height - 12, JSON.stringify(b));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      return b;
    }
    async function drag(handle, dx, dy, touch = false) {
      const b = await handle.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      if (touch) {
        const session = await context.newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 8; i++) {
          await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 8, y: y + dy * i / 8 }] });
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await session.detach();
      } else {
        await page.mouse.move(x, y); await page.mouse.down();
        await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up();
      }
      await page.waitForTimeout(100);
    }
    await open();
    const initial = await bounds();
    assert.equal(await chat.evaluate(el => getComputedStyle(el).borderTopColor), 'rgb(20, 20, 20)');
    assert.equal(await chat.evaluate(el => getComputedStyle(el).borderTopLeftRadius), '16px');
    assert.equal(await chat.locator('header').evaluate(el => el.previousElementSibling.tagName), 'BUTTON');
    await page.screenshot({ path: `frontend/design/captures/chat-smooth-default-${width}.png` });
    await input.fill('Черновик при изменении размера');
    const messages = await chat.locator('article').count();
    await drag(corner, 40, 80, width < 650);
    const smaller = await bounds();
    assert.equal(smaller.width, Math.max(280, initial.width - 40));
    assert.equal(smaller.height, initial.height - 80);
    await drag(corner, -24, -48, width < 650);
    const larger = await bounds();
    assert.equal(larger.width, smaller.width + Math.min(24, initial.width - smaller.width));
    assert.equal(larger.height, smaller.height + 48);
    const widthHandle = page.getByRole('button', { name: 'Изменить ширину чата', exact: true });
    await drag(widthHandle, 16, 0);
    const narrow = await bounds();
    assert.equal(narrow.height, larger.height);
    assert.equal(narrow.width, Math.max(280, larger.width - 16));
    const heightHandle = page.getByRole('button', { name: 'Изменить высоту чата', exact: true });
    await drag(heightHandle, 0, 16);
    assert.equal((await bounds()).width, narrow.width);
    await corner.focus(); await corner.press('ArrowLeft'); await corner.press('ArrowUp');
    assert.equal(await input.inputValue(), 'Черновик при изменении размера');
    assert.equal(await chat.locator('article').count(), messages);
    assert(await page.getByRole('log').evaluate(el => Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 3));
    const resized = await bounds();
    await page.screenshot({ path: `frontend/design/captures/chat-smooth-resized-${width}.png` });
    await page.getByRole('button', { name: 'Закрыть чат' }).click();
    await open();
    assert.equal((await bounds()).width, resized.width);
    assert.equal((await bounds()).height, resized.height);
    assert.equal(await input.inputValue(), 'Черновик при изменении размера');
    await page.reload({ waitUntil: 'networkidle' }); await open();
    assert.equal((await bounds()).width, resized.width);
    assert.equal((await bounds()).height, resized.height);
    await drag(corner, -2000, -2000); await bounds();
    await drag(corner, 2000, 2000); const minimum = await bounds();
    assert.equal(minimum.width, 280); assert.equal(minimum.height, 240);
    await input.fill('Привет'); await input.press('Enter');
    assert.equal(await chat.locator('article').count(), messages + 2);
    await page.setViewportSize({ width: Math.min(width, 390), height: 400 });
    await page.waitForTimeout(100); await bounds();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await chat.evaluate(el => getComputedStyle(el).animationName), 'none');
    results.push({ width, initial, resized, mouse: true, touch: width < 650, keyboard: true, savedSize: true, bounds: true, messagesPreserved: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile('frontend/design/captures/chat-smooth-verification.json', JSON.stringify({ results, errors }, null, 2));
  console.log('PASS: smooth chat; mouse/touch/keyboard resizing, saved size, viewport bounds, messages, reduced motion');
} finally { await browser.close(); }
