import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch();
const reports = [], errors = [];
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 650 });
    await context.addInitScript(() => localStorage.setItem('buddy-pet', 'orbit'));
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    const pet = page.locator('.widget-pet'), bubble = page.locator('.pixel-dialogue');
    const typed = page.locator('.dialogue-typed'), full = page.locator('.dialogue-accessible');
    const spotlight = page.locator('.companion-spotlight');
    const input = page.getByRole('textbox', { name: 'Запрос для пета' });
    const send = page.getByRole('button', { name: 'Отправить запрос' });
    async function open() {
      await page.waitForTimeout(400);
      await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
      await spotlight.waitFor();
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Запрос для пета');
    }
    async function onlyInput() {
      assert.equal(await spotlight.getByRole('status').count(), 0);
      assert.equal(await spotlight.locator(':scope > *').count(), 1);
      assert.equal((await spotlight.boundingBox()).height, 56);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await pet.dblclick(); await bubble.waitFor();
    const greeting = await full.textContent();
    await page.getByRole('button', { name: 'Закрыть приветствие', exact: true }).click();
    await open(); await input.fill('Как получить доступ?'); await input.press('Enter');
    await bubble.waitFor(); const answer = await full.textContent();
    assert.match(answer, /к какому сервису/); assert.notEqual(answer, greeting);
    await page.waitForFunction(() => document.querySelector('.dialogue-typed').textContent.length > 0);
    assert((await typed.textContent()).length < answer.length);
    assert(await page.locator('.companion').evaluate(element => element.classList.contains('is-talking')));
    assert.equal(await bubble.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(48, 53, 82)');
    await onlyInput();
    await page.screenshot({ path: `frontend/design/captures/spotlight-pet-reply-typing-${width}.png` });
    await page.getByRole('button', { name: 'Показать сразу' }).click(); assert.equal(await typed.textContent(), answer);
    await page.screenshot({ path: `frontend/design/captures/spotlight-pet-reply-${width}.png` });
    await input.fill('Как получить доступ?'); await send.click();
    assert((await typed.textContent()).length < answer.length, 'The same answer must restart typing');
    await page.waitForFunction(() => document.querySelector('.dialogue-typed').textContent.length > 0);
    await page.getByRole('button', { name: 'Показать сразу' }).click();
    await page.waitForTimeout(200); assert.equal(await typed.textContent(), answer);
    await input.fill('Спасибо'); await send.click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('.dialogue-typed').textContent === document.querySelector('.dialogue-accessible').textContent);
    assert.match(await typed.textContent(), /Всегда рядом/); await onlyInput();
    await input.focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    assert.equal(await spotlight.count(), 0); assert(await bubble.isVisible());
    await page.keyboard.press('Escape'); assert.equal(await bubble.count(), 0);
    await page.waitForTimeout(400); await pet.dblclick();
    assert.equal(await full.textContent(), greeting, 'Double click still opens the pet greeting');
    await page.getByRole('button', { name: 'Закрыть приветствие', exact: true }).click();
    await page.getByRole('button', { name: 'Скрыть спутника', exact: true }).click(); assert.equal(await pet.count(), 0);
    await open(); await input.fill('Спасибо'); await input.press('Enter');
    await pet.waitFor(); await bubble.waitFor(); assert.match(await full.textContent(), /Всегда рядом/); await onlyInput();
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(400); await pet.click();
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    await page.getByRole('switch').click(); await page.keyboard.press('Escape');
    await open(); await input.fill('Спасибо'); await input.press('Enter');
    assert.equal(await typed.textContent(), await full.textContent());
    assert.equal(await page.getByRole('button', { name: 'Показать сразу' }).count(), 0);
    const before = await spotlight.boundingBox(), box = await pet.boundingBox();
    const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const cdp = await context.newCDPSession(page);
    if (width < 650) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
    for (let step = 1; step <= 8; step++) {
      const point = { x: start.x - step * 3, y: start.y - step * 6 };
      if (width < 650) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
      else await page.mouse.move(point.x, point.y);
    }
    if (width < 650) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.up();
    assert(await bubble.isVisible()); assert.deepEqual(await spotlight.boundingBox(), before);
    const bounds = await bubble.boundingBox();
    assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= 900);
    await page.getByRole('button', { name: 'Закрыть ответ', exact: true }).click();
    assert.equal(await bubble.count(), 0); assert(await spotlight.isVisible());
    reports.push({ width, samePixelDialogue: true, progressiveText: true, skip: true, repeatedReplyRestarts: true,
      noSpotlightResults: true, reducedMotion: true, paused: true, greetingPreserved: true,
      hiddenPetRestored: true, petDrag: true, independentClosing: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile('frontend/design/captures/spotlight-reply-verification.json', JSON.stringify({ reports, errors }, null, 2));
  console.log('PASS Spotlight replies: pet dialogue, typing/restart, no result panel, skip, greeting, pause, reduced motion, drag');
} finally { await browser.close(); }
