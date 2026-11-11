import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch();
const errors = [], results = [];
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 650 });
    await context.addInitScript(() => {
      localStorage.setItem('buddy-pet', 'orbit');
      localStorage.setItem('buddy-favorites', '["orbit","orbi-neo"]');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    const pet = page.locator('.widget-pet');
    const cdp = await context.newCDPSession(page);
    async function dragTo(x, y, check, touch = false) {
      const box = await pet.boundingBox();
      const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
      else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
      for (let step = 1; step <= 8; step++) {
        const point = { x: start.x + (x - start.x) * step / 8, y: start.y + (y - start.y) * step / 8 };
        if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
        else await page.mouse.move(point.x, point.y);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await check();
      }
      if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await page.mouse.up();
      await page.waitForTimeout(100);
      await check();
      const end = await pet.boundingBox();
      assert(Math.abs(end.x - Math.max(8, Math.min(x - box.width / 2, width - box.width - 8))) <= 1, JSON.stringify(end));
      assert(Math.abs(end.y - Math.max(8, Math.min(y - box.height / 2, 900 - box.height - 8))) <= 1, JSON.stringify(end));
    }
    async function open(action) {
      await page.waitForTimeout(400);
      await pet.click();
      await page.getByRole('button', { name: action, exact: true }).click();
      await page.waitForTimeout(450);
    }
    async function bounds(locator) {
      const boxes = await locator.evaluateAll(elements => elements.map(element => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, right: box.right, bottom: box.bottom };
      }));
      for (const box of boxes) assert(box.x >= 0 && box.y >= 0 && box.right <= width && box.bottom <= 900, JSON.stringify(box));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await open('Чат');
    const chat = page.getByRole('dialog', { name: 'Орби', exact: true });
    const input = page.getByRole('textbox', { name: 'Сообщение спутнику' });
    await input.fill('Сохранённый черновик');
    const originalChat = await chat.elementHandle();
    const initialChat = await chat.boundingBox(), initialPet = await pet.boundingBox();
    const checkChat = async () => {
      assert(await originalChat.evaluate(element => element.isConnected));
      assert(await chat.isVisible());
      assert.equal(await input.inputValue(), 'Сохранённый черновик');
      await bounds(chat);
    };
    await dragTo(initialPet.x + initialPet.width / 2 - 40, initialPet.y + initialPet.height / 2 - 60, checkChat, width < 650);
    const movedChat = await chat.boundingBox(), movedPet = await pet.boundingBox();
    assert.equal(movedChat.y - initialChat.y, movedPet.y - initialPet.y);
    await page.screenshot({ path: `frontend/design/captures/companion-drag-chat-${width}.png` });
    await dragTo(80, 65, checkChat, width < 650);
    await page.screenshot({ path: `frontend/design/captures/companion-drag-chat-edge-${width}.png` });
    await page.getByRole('button', { name: 'Отправить сообщение' }).click();
    assert.equal(await chat.locator('article[data-role="user"]').last().innerText().then(text => text.includes('Сохранённый черновик')), true);
    await page.keyboard.press('Escape');
    await open('Гардероб');
    const wardrobe = page.getByRole('region', { name: 'Гардероб спутника' });
    await wardrobe.press('ArrowRight');
    await page.waitForTimeout(900);
    const activePet = await wardrobe.locator('[data-center="true"]').getAttribute('data-pet-id');
    const checkWardrobe = async () => {
      assert.equal(await wardrobe.getAttribute('aria-hidden'), 'false');
      assert.equal(await wardrobe.locator('[data-center="true"]').getAttribute('data-pet-id'), activePet);
      await bounds(wardrobe.locator('.wardrobe-pet[aria-hidden="false"]'));
    };
    await dragTo(width - 80, 820, checkWardrobe, width < 650);
    await page.screenshot({ path: `frontend/design/captures/companion-drag-wardrobe-${width}.png` });
    await wardrobe.press('ArrowRight'); await page.waitForTimeout(900);
    assert.notEqual(await wardrobe.locator('[data-center="true"]').getAttribute('data-pet-id'), activePet);
    await page.keyboard.press('Escape');
    await open('Настройки');
    const settings = page.getByRole('dialog', { name: 'Настройки спутника' });
    await dragTo(width - 100, 680, async () => { assert(await settings.isVisible()); await bounds(settings); }, width < 650);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400); await pet.click(); await page.waitForTimeout(400);
    await dragTo(width - 100, 780, async () => {
      assert.equal(await page.locator('.companion-orbit-menu').getAttribute('aria-hidden'), 'false');
    }, width < 650);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400); await pet.dblclick();
    await dragTo(width - 100, 680, async () => assert(await page.locator('.pixel-dialogue').isVisible()), width < 650);
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open('Чат');
    await dragTo(width - 100, 780, async () => assert(await chat.isVisible()), width < 650);
    await page.mouse.click(10, 450); assert.equal(await chat.count(), 0);
    assert.equal(await page.evaluate(() => localStorage.getItem('buddy-pet')), 'orbit');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('buddy-favorites'))), ['orbit', 'orbi-neo']);
    results.push({ width, pointer: width < 650 ? 'touch' : 'mouse', chat: true, draft: true, wardrobe: true,
      carouselPosition: true, settings: true, menu: true, dialogue: true, edgeBounds: true, reducedMotion: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile('frontend/design/captures/companion-drag-verification.json', JSON.stringify({ results, errors }, null, 2));
  console.log('PASS companion drag: open panels follow mouse/touch, preserve state, respect bounds, remain usable');
} finally { await browser.close(); }
