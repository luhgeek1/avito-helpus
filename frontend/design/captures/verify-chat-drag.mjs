import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs');
const browser = await chromium.launch(), results = [], errors = [];
try {
  for (const width of [1440, 1366, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width < 650, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      localStorage.setItem('buddy-onboarding-v1', 'done'); localStorage.setItem('buddy-pet', 'orbit');
      localStorage.setItem('buddy-chat-size', '{"width":400,"height":2000}');
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(process.env.PET_TEST_URL ?? 'http://localhost:5173', { waitUntil: 'networkidle' });
    const pet = page.locator('.widget-pet'), chat = page.getByRole('dialog', { name: 'Орби', exact: true });
    const header = page.getByRole('group', { name: 'Переместить чат', exact: true });
    const input = page.getByRole('textbox', { name: 'Сообщение спутнику' });
    async function open() {
      await page.waitForTimeout(400); await pet.click();
      await page.getByRole('button', { name: 'Чат', exact: true }).click(); await chat.waitFor();
    }
    async function drag(target, dx, dy, touch = false) {
      const b = await target.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      if (touch) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 8, y: y + dy * i / 8 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
      } else {
        await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up();
      }
      await page.waitForTimeout(100);
    }
    async function bounds() {
      const b = await chat.boundingBox(), v = page.viewportSize();
      assert(b.x >= 12 && b.y >= 12 && b.x + b.width <= v.width - 12 && b.y + b.height <= v.height - 12, JSON.stringify(b));
      return b;
    }
    await open(); const initial = await bounds(), petInitial = await pet.boundingBox();
    assert(initial.y + initial.height < petInitial.y, 'A saved tall window must leave room for the pet');
    assert.equal(await chat.getByRole('button', { name: 'Изменить размер чата', exact: true }).locator('svg').count(), 0);
    await input.fill('Черновик остаётся');
    await page.screenshot({ path: `frontend/design/captures/chat-fixed-default-${width}.png` });
    await pet.focus(); await pet.press('ArrowLeft'); await pet.press('ArrowUp');
    assert.deepEqual(await bounds(), initial, 'Moving the pet must not move the chat');
    await page.getByRole('button', { name: 'Закрыть чат', exact: true }).click(); await open();
    assert.deepEqual(await bounds(), initial, 'The starting position must not depend on the pet');
    await header.focus(); await header.press('ArrowDown');
    assert.equal((await bounds()).y, initial.y + 16);
    const before = await bounds(), petBefore = await pet.boundingBox();
    await drag(header, -80, 32, width < 650); const moved = await bounds();
    assert.equal(moved.y, before.y + 32); assert(moved.x <= before.x);
    assert.deepEqual(await pet.boundingBox(), petBefore, 'Chat movement must not move the pet');
    assert.equal(await input.inputValue(), 'Черновик остаётся');
    await page.getByRole('button', { name: 'Закрыть чат', exact: true }).click(); await open();
    assert.deepEqual(await bounds(), initial, 'Reopening must return to the fixed starting zone');
    const grip = page.getByRole('button', { name: 'Изменить размер чата', exact: true });
    await grip.focus(); await grip.press('ArrowRight'); await grip.press('ArrowDown');
    await drag(header, 0, 2000, width < 650); await bounds();
    const petBox = await pet.boundingBox();
    assert(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.widget-pet'),
      { x: petBox.x + petBox.width / 2, y: petBox.y + petBox.height / 2 }), 'The pet must remain above an overlapping window');
    await drag(header, 0, -2000, width < 650); await bounds();
    await input.focus(); await page.screenshot({ path: `frontend/design/captures/chat-fixed-moved-${width}.png` });
    const count = await chat.locator('article').count();
    await page.getByRole('button', { name: 'Отправить сообщение', exact: true }).click();
    assert.equal(await chat.locator('article').count(), count + 2);
    await page.getByRole('button', { name: 'Назад к меню пета', exact: true }).click();
    assert.equal(await chat.count(), 0); await page.getByRole('button', { name: 'Чат', exact: true }).click();
    await page.setViewportSize({ width: Math.min(width, 390), height: 400 });
    await page.waitForTimeout(100); await bounds();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    results.push({ width, fixedStart: true, independentPet: true, drag: width < 650 ? 'touch' : 'mouse', keyboard: true, petAboveChat: true, savedTallSize: true, draft: true, send: true, buttons: true, viewport: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile('frontend/design/captures/chat-fixed-verification.json', JSON.stringify({ results, errors }, null, 2));
  console.log('PASS: fixed opening zone, independent dragging, visible pet, resize, draft, controls and viewport bounds');
} finally { await browser.close(); }
