import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '../../node_modules/playwright/index.mjs';

const browser = await chromium.launch();
const results = [], errors = [];
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
try {
  for (const width of [1440, 1366, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 650,
      reducedMotion: [1366, 320].includes(width) ? 'reduce' : 'no-preference' });
    await context.addInitScript(() => {
      localStorage.setItem('buddy-onboarding-v1', 'done');
      localStorage.setItem('buddy-pet', 'orbit');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.PET_TEST_URL ?? 'http://localhost:5173', { waitUntil: 'networkidle' });
    const pet = page.locator('.widget-pet'), chat = page.locator('.companion-chat');
    const open = async () => {
      await page.getByRole('button', { name: 'Чат', exact: true }).click();
      await chat.waitFor();
      await page.waitForTimeout(350);
    };
    async function move(target, x, y, steps = 1) {
      const b = await target.boundingBox(), start = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      if (width < 650) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
        for (let i = 1; i <= steps; i++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{
            x: start.x + (x - start.x) * i / steps, y: start.y + (y - start.y) * i / steps }] });
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
      } else {
        await page.mouse.move(start.x, start.y); await page.mouse.down();
        await page.mouse.move(x, y, { steps }); await page.mouse.up();
      }
      await page.waitForTimeout(100);
    }
    async function clear() {
      const p = await pet.boundingBox(), c = await chat.boundingBox();
      assert(!overlaps(p, c), JSON.stringify({ width, p, c }));
      assert(p.x >= 8 && p.y >= 8 && p.x + p.width <= width - 8 && p.y + p.height <= page.viewportSize().height - 8);
      return { pet: p, chat: c };
    }
    await open();
    const initial = await clear();
    await move(pet, initial.pet.x + initial.pet.width / 2, 10);
    const stopped = await clear();
    assert.equal(stopped.pet.y, stopped.chat.y + stopped.chat.height + 8, 'Fast drag must stop below the chat');
    assert.deepEqual(stopped.chat, initial.chat);
    await pet.focus();
    for (let i = 0; i < 6; i++) await pet.press('Shift+ArrowUp');
    assert.equal((await clear()).pet.y, stopped.pet.y, 'Keyboard must respect the boundary');
    await move(pet, Math.max(80, stopped.pet.x - 150), stopped.pet.y + stopped.pet.height / 2 - 100, 8);
    await clear();
    await page.screenshot({ path: `frontend/design/captures/chat-boundary-${width}.png` });
    await page.getByRole('button', { name: 'Закрыть чат', exact: true }).click();
    const center = { x: initial.chat.x + initial.chat.width / 2, y: initial.chat.y + initial.chat.height / 2 };
    await move(pet, center.x, center.y, 8);
    assert(overlaps(await pet.boundingBox(), initial.chat), 'Closing must release the chat area');
    await open(); await clear();
    const header = page.getByRole('group', { name: 'Переместить чат', exact: true });
    await header.focus();
    for (let i = 0; i < 5; i++) { await header.press('Shift+ArrowDown'); await clear(); }
    const grip = page.getByRole('button', { name: 'Изменить размер чата', exact: true });
    await grip.focus();
    for (let i = 0; i < 4; i++) { await grip.press('Shift+ArrowUp'); await clear(); }
    await page.setViewportSize({ width, height: 760 }); await page.waitForTimeout(100); await clear();
    if (width < 650) {
      // A full-height mobile chat leaves no legal position for the pet.
      await header.focus();
      for (let i = 0; i < 30; i++) await header.press('Shift+ArrowDown');
      await grip.focus();
      for (let i = 0; i < 30; i++) await grip.press('Shift+ArrowUp');
      await pet.waitFor({ state: 'hidden' });
      assert.equal(await page.getByRole('button', { name: 'Чат', exact: true }).count(), 0);
      await page.screenshot({ path: `frontend/design/captures/chat-boundary-full-${width}.png` });
      await page.getByRole('button', { name: 'Закрыть чат', exact: true }).click();
      await pet.waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Чат', exact: true }).waitFor();
    }
    results.push({ width, input: width < 650 ? 'touch' : 'mouse', fastDrag: true, keyboard: true, slide: true,
      closeReleasesBoundary: true, openingResolvesOverlap: true, chatMovement: true, chatResize: true, viewportResize: true,
      fullMobileChatHidesPet: width < 650 });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile('frontend/design/captures/chat-boundary-verification.json', JSON.stringify({ results, errors }, null, 2) + '\n');
  console.log('PASS: chat boundary, fast dragging, touch, keyboard, closing, opening, movement and resize');
} finally { await browser.close(); }
