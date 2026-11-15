import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { rename, writeFile } from 'node:fs/promises';

const captures = new URL('./', import.meta.url).pathname;
const browser = await chromium.launch();
const results = [], errors = [];
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
async function center(circle) {
  const box = await circle.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
try {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height },
      recordVideo: { dir: captures, size: { width, height } } });
    await context.addInitScript(() => {
      localStorage.setItem('buddy-pet', 'orbit');
      localStorage.setItem('buddy-onboarding-v1', 'done');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.VERIFY_URL ?? 'http://127.0.0.1:5173', { waitUntil: 'networkidle' });
    const poll = page.getByRole('button', { name: 'Закрыть опрос', exact: true });
    if (await poll.isVisible()) await poll.click();
    const pet = page.locator('.widget-pet');
    const bubble = page.getByRole('button', { name: 'Чат', exact: true });
    const node = await bubble.elementHandle();
    const circle = bubble.locator('svg').first().locator(':scope > g > path').nth(1);
    const rest = await center(circle);
    await page.screenshot({ path: `${captures}chat-docking-rest-${width}.png` });
    await pet.click();
    await page.waitForTimeout(70);
    const opening = await center(circle);
    await page.screenshot({ path: `${captures}chat-docking-opening-${width}.png` });
    await page.waitForTimeout(320);
    const docked = await center(circle);
    assert(distance(rest, docked) > 35);
    assert(distance(rest, opening) > 1 && distance(opening, docked) > 1, 'Opening must have an intermediate position');
    const geometry = await page.locator('#companion-actions button').evaluateAll(buttons => {
      const anchor = document.querySelector('.widget-pet').getBoundingClientRect();
      const cx = anchor.x + anchor.width / 2, cy = anchor.y + anchor.height / 2;
      return buttons.map(button => {
        const svg = button.querySelector('svg');
        const circle = svg.querySelector(button.classList.contains('companion-chat-bubble') ? 'g > path:nth-of-type(2)' : 'path:nth-of-type(2)');
        const box = circle.getBoundingClientRect();
        return { label: button.getAttribute('aria-label'), diameter: box.width,
          radius: Math.hypot(box.x + box.width / 2 - cx, box.y + box.height / 2 - cy) };
      });
    });
    assert.equal(geometry.length, 4);
    assert(Math.max(...geometry.map(item => item.radius)) - Math.min(...geometry.map(item => item.radius)) < 1, 'All four buttons must share the arc');
    assert(Math.max(...geometry.map(item => item.diameter)) - Math.min(...geometry.map(item => item.diameter)) < 1, 'All four circles must match');
    await page.screenshot({ path: `${captures}chat-docking-open-${width}.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(70);
    const closing = await center(circle);
    assert(distance(docked, closing) > 1 && distance(closing, rest) > 1, 'Return must have an intermediate position');
    await page.screenshot({ path: `${captures}chat-docking-returning-${width}.png` });
    await page.waitForTimeout(320);
    assert(distance(await center(circle), rest) < 1);
    await page.screenshot({ path: `${captures}chat-docking-returned-${width}.png` });
    for (const delay of [40, 80, 120]) {
      await pet.click();
      await page.waitForTimeout(delay);
      const before = await center(circle);
      await page.keyboard.press('Escape');
      const after = await center(circle);
      assert(distance(before, after) < distance(rest, docked) * .4, 'Reversing must not teleport');
      await page.waitForTimeout(350);
      assert(distance(await center(circle), rest) < 1);
    }
    assert(await node.evaluate(element => element === document.querySelector('.companion-chat-bubble')), 'The button must keep the same DOM node');
    await pet.click();
    await page.waitForTimeout(350);
    await bubble.click();
    const chat = page.getByRole('dialog', { name: 'Орби', exact: true });
    await expect(chat).toBeVisible();
    await page.waitForTimeout(350);
    assert(distance(await center(circle), rest) < 1);
    await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await pet.click();
    assert.equal(await bubble.evaluate(element => getComputedStyle(element).transitionProperty), 'none');
    assert(distance(await center(circle), docked) < 1);
    await page.keyboard.press('Escape');
    assert(distance(await center(circle), rest) < 1);
    results.push({ width, height, intermediatePositions: true, arc: geometry, sameNode: true,
      interruptedReturn: true, dockedChat: true, reducedMotion: true });
    const video = page.video();
    await context.close();
    await rename(await video.path(), `${captures}chat-docking-${width}.webm`);
  }
  assert.deepEqual(errors, []);
  await writeFile(`${captures}chat-docking-verification.json`, JSON.stringify({ results, errors }, null, 2));
  console.log('PASS chat docking: shared arc/size, opening/return frames, interrupted return, persistent node, chat, reduced motion');
} finally { await browser.close(); }
