import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch();
const results = [], errors = [];
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 650 });
    await context.addInitScript(() => {
      localStorage.setItem('buddy-pet', 'orbit');
      localStorage.setItem('buddy-favorites', '["orbit","orbi-neo"]');
    });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    const panel = page.getByRole('dialog', { name: 'Запрос к Орби' });
    const input = page.getByRole('textbox', { name: 'Запрос для пета' });
    const send = page.getByRole('button', { name: 'Отправить запрос' });
    const bubble = page.locator('.pixel-dialogue');
    const handle = panel;
    const pet = page.locator('.widget-pet');
    const cdp = await context.newCDPSession(page);
    async function shortcut() { await page.keyboard.press('Enter'); await page.keyboard.press('NumpadEnter'); await panel.waitFor(); }
    async function bounds() {
      const box = await panel.boundingBox();
      const viewport = page.viewportSize();
      assert(box.x >= 8 && box.y >= 8 && box.x + box.width <= viewport.width - 8 && box.y + box.height <= viewport.height - 8, JSON.stringify(box));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    async function moveTo(x, y, target = input) {
      const box = await target.boundingBox(), initial = await panel.boundingBox();
      const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      if (width < 650) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
      for (let step = 1; step <= 8; step++) {
        const point = { x: start.x + (x - start.x) * step / 8, y: start.y + (y - start.y) * step / 8 };
        if (width < 650) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
        else await page.mouse.move(point.x, point.y);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        assert(await panel.isVisible()); await bounds();
      }
      if (width < 650) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await page.mouse.up();
      const end = await panel.boundingBox();
      assert(Math.abs(end.x - Math.max(8, Math.min(initial.x + x - start.x, width - end.width - 8))) <= 1,
        JSON.stringify({ width, box, initial, start, end, destination: { x, y } }));
      assert(Math.abs(end.y - Math.max(8, Math.min(initial.y + y - start.y, 900 - end.height - 8))) <= 1,
        JSON.stringify({ width, target: await target.getAttribute('role'), box, initial, start, end, destination: { x, y } }));
      await bounds();
    }
    await page.keyboard.press('Enter'); assert.equal(await panel.count(), 0);
    await page.waitForTimeout(450); await page.keyboard.press('Enter'); assert.equal(await panel.count(), 0);
    await page.keyboard.press('a'); await shortcut();
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Запрос для пета');
    await page.keyboard.press('Enter'); await page.keyboard.press('NumpadEnter');
    assert.equal(await panel.count(), 0);
    await shortcut();
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Запрос для пета');
    await panel.focus();
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); assert.equal(await panel.count(), 0);
    await shortcut();
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Запрос для пета');
    const beforeToggleSend = await page.evaluate(() => JSON.parse(localStorage.getItem('buddy-chat')).length);
    await input.fill('Проверка переключателя'); await input.press('Enter');
    assert(await panel.isVisible());
    await input.press('NumpadEnter'); assert.equal(await panel.count(), 0);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('buddy-chat')).length), beforeToggleSend + 2);
    await shortcut();
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Запрос для пета');
    assert.equal(await input.evaluate(element => element === document.activeElement), true);
    assert.equal(await send.count(), 0);
    assert.equal(await panel.locator('form').evaluate(element => element.getBoundingClientRect().height), 56);
    assert.equal(await panel.locator('header').count(), 0);
    assert.equal(await input.getAttribute('placeholder'), 'Спросить Орби');
    assert.equal(await panel.evaluate(element => getComputedStyle(element).cursor), 'default');
    assert.equal(await panel.locator('form').evaluate(element => getComputedStyle(element).cursor), 'default');
    assert.equal(await input.evaluate(element => getComputedStyle(element).cursor), 'text');
    assert.equal(await panel.getByRole('button', { name: 'Переместить окно запроса' }).count(), 0);
    await bounds(); await page.waitForTimeout(250);
    await page.screenshot({ path: `frontend/design/captures/spotlight-initial-${width}.png` });
    if (width === 1440) await panel.screenshot({ path: 'frontend/design/captures/spotlight-free-drag-preview.png' });
    await input.fill('   '); await input.press('Enter'); assert.equal(await send.count(), 0);
    const count = await page.evaluate(() => JSON.parse(localStorage.getItem('buddy-chat')).length);
    await input.fill('Как получить доступ?'); await input.press('Enter');
    assert.equal(await input.inputValue(), '');
    assert.match(await bubble.getByRole('status').innerText(), /к какому сервису/);
    assert.equal(await panel.getByRole('status').count(), 0);
    assert.equal((await panel.boundingBox()).height, 56);
    await page.waitForFunction(count => JSON.parse(localStorage.getItem('buddy-chat')).length === count + 2, count);
    await input.fill('Спасибо'); await send.click();
    assert.match(await bubble.getByRole('status').innerText(), /Всегда рядом/);
    await input.fill('Не отправлять');
    await input.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true })));
    await input.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, repeat: true })));
    assert.equal(await input.inputValue(), 'Не отправлять');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('buddy-chat')).length), count + 4);
    await page.screenshot({ path: `frontend/design/captures/spotlight-response-${width}.png` });
    const petBefore = await pet.boundingBox();
    await input.evaluate(element => element.select());
    await moveTo(width / 2, 500);
    await input.click(); assert(await input.evaluate(element => element === document.activeElement));
    await input.press('Home'); await input.press('ArrowRight');
    assert.equal(await input.evaluate(element => element.selectionStart), 1);
    await moveTo(width / 2, 400, panel.locator('[data-spotlight-icon]'));
    await moveTo(width / 2, 650, send);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('buddy-chat')).length), count + 4);
    await moveTo(20, 840); assert.equal(await input.inputValue(), 'Не отправлять');
    assert.deepEqual(await pet.boundingBox(), petBefore);
    await page.screenshot({ path: `frontend/design/captures/spotlight-dragged-${width}.png` });
    await handle.focus(); await handle.press('ArrowUp');
    const saved = await panel.boundingBox();
    await page.keyboard.press('Escape'); assert.equal(await panel.count(), 0);
    await page.locator('body').click({ position: { x: width - 4, y: 120 } }); await shortcut();
    assert.equal((await panel.boundingBox()).y, saved.y);
    assert.equal(await input.inputValue(), 'Не отправлять');
    await page.setViewportSize({ width, height: 400 }); await page.waitForTimeout(300); await bounds();
    await page.screenshot({ path: `frontend/design/captures/spotlight-short-${width}.png` });
    await page.keyboard.press('Escape'); assert.equal(await panel.count(), 0);
    await page.setViewportSize({ width, height: 900 });
    await pet.focus(); await page.waitForTimeout(450); await shortcut();
    assert.equal(await page.locator('.pixel-dialogue').count(), 0);
    assert.equal(await page.locator('.companion-orbit-menu').getAttribute('aria-hidden'), 'true');
    await page.keyboard.press('Escape'); assert.equal(await pet.evaluate(element => element === document.activeElement), true);
    await page.waitForTimeout(450); await pet.click(); await page.getByRole('button', { name: 'Чат', exact: true }).click();
    const chatInput = page.getByRole('textbox', { name: 'Сообщение спутнику' });
    assert.equal(await chatInput.inputValue(), 'Не отправлять');
    await chatInput.fill('Спасибо'); await chatInput.press('Enter'); await chatInput.press('Enter');
    assert.equal(await panel.count(), 0);
    assert(await page.locator('.companion-chat').getByText('Как получить доступ?', { exact: true }).isVisible());
    await page.keyboard.press('Escape'); await page.waitForTimeout(450);
    await page.goto('http://localhost:5173/pets', { waitUntil: 'networkidle' });
    await page.locator('body').click({ position: { x: width - 4, y: 120 } }); await shortcut();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await panel.evaluate(element => getComputedStyle(element).animationName), 'none');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => localStorage.getItem('buddy-pet')), 'orbit');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('buddy-favorites'))), ['orbit', 'orbi-neo']);
    results.push({ width, shortcut: true, doubleEnterToggle: true, defaultEdgeCursor: true, numpadEnter: true, focus: true, send: true, empty: true, ime: true,
      mouseOrTouchDrag: true, dragInputIconAndSend: true, petBubbleReply: true, noSpotlightResults: true, caret: true, noAccidentalActions: true,
      independentPosition: true, savedPosition: true, shortViewport: true, chatHistory: true,
      chatInputUnaffected: true, gallery: true, reducedMotion: true, favoritesPreserved: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile('frontend/design/captures/spotlight-verification.json', JSON.stringify({ results, errors }, null, 2));
  console.log('PASS spotlight: shortcut, focus, send, shared history, mouse/touch drag, persistence, bounds, reduced motion');
} finally { await browser.close(); }
