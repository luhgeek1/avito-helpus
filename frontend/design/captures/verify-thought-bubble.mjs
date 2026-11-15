import { chromium, expect } from 'playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch();
const errors = [], results = [];
const baseURL = process.env.VERIFY_URL ?? 'http://127.0.0.1:5173';
const captures = new URL('./', import.meta.url).pathname;
async function dragTo(page, x, y) {
  const box = await page.locator('.widget-pet').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x + box.width / 2, y + box.height / 2, { steps: 12 });
  await page.mouse.up();
}
async function assertAvailable(locator, width, height) {
  const box = await locator.boundingBox();
  assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height, JSON.stringify(box));
  assert(await locator.evaluate(element => {
    const box = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  }), `${await locator.getAttribute('aria-label')} is covered`);
}
try {
  for (const [width, height] of [[1440, 900], [1366, 768], [390, 844], [320, 700]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 650 });
    await context.addInitScript(() => {
      localStorage.setItem('buddy-onboarding-v1', 'done');
      localStorage.setItem('buddy-pet', 'orbit');
      localStorage.setItem('buddy-favorites', '["orbi-neo"]');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    const pet = page.getByRole('button', { name: 'Действия спутника Орби', exact: true });
    const bubble = page.getByRole('button', { name: 'Чат', exact: true });
    await expect(bubble).toBeVisible();
    await expect(page.getByRole('button', { name: 'Скрыть спутника', exact: true })).toHaveCount(0);
    assert((await bubble.boundingBox()).width >= 44);
    await page.screenshot({ path: `${captures}thought-bubble-${width}.png` });
    await bubble.click();
    const chat = page.getByRole('dialog', { name: 'Орби', exact: true });
    await expect(chat).toBeVisible();
    await expect(bubble).toHaveAttribute('aria-expanded', 'true');
    await chat.getByRole('button', { name: 'Закрыть чат', exact: true }).click();
    await pet.click();
    const menu = page.getByRole('group', { name: 'Действия спутника', exact: true });
    await page.waitForFunction(() => document.querySelector('#companion-actions').dataset.interactive === 'true');
    await expect(menu.getByRole('button')).toHaveCount(4);
    for (const button of await menu.getByRole('button').all()) await assertAvailable(button, width, height);
    await assertAvailable(bubble, width, height);
    await page.screenshot({ path: `${captures}thought-bubble-menu-${width}.png` });
    await menu.getByRole('button', { name: 'Скрыть спутника', exact: true }).click();
    await expect(bubble).toHaveCount(0);
    await page.getByRole('button', { name: 'Орби рядом', exact: true }).click();
    await expect(bubble).toBeVisible();
    for (const [x, y] of [[8, 8], [width - 168, 8], [8, height - 136], [width - 168, height - 136]]) {
      await dragTo(page, x, y);
      await assertAvailable(bubble, width, height);
      await bubble.click();
      await expect(chat).toBeVisible();
      await page.keyboard.press('Escape');
      await pet.click();
      await page.waitForFunction(() => document.querySelector('#companion-actions').dataset.interactive === 'true');
      for (const button of await menu.getByRole('button').all()) await assertAvailable(button, width, height);
      await page.keyboard.press('Escape');
    }
    await dragTo(page, 8, 8);
    await page.screenshot({ path: `${captures}thought-bubble-edge-${width}.png` });
    const saved = await page.evaluate(() => localStorage.getItem('buddy-position'));
    await page.reload({ waitUntil: 'networkidle' });
    await expect(bubble).toBeVisible();
    assert.equal(await page.evaluate(() => localStorage.getItem('buddy-position')), saved);
    await pet.focus();
    await page.keyboard.press('ArrowRight');
    await assertAvailable(bubble, width, height);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await bubble.evaluate(element => getComputedStyle(element).transitionProperty), 'none');
    assert.equal(await bubble.locator('svg').first().evaluate(element => getComputedStyle(element).animationName), 'none');
    await bubble.focus();
    await page.keyboard.press('Enter');
    await expect(chat).toBeVisible();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('buddy-favorites'))), ['orbi-neo']);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    results.push({ width, height, directChat: true, menuHide: true, restore: true, dragCorners: true, reload: true, keyboard: true, reducedMotion: true });
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${captures}thought-bubble-verification.json`, JSON.stringify({ results, errors }, null, 2));
  console.log('PASS thought bubble: desktop/mobile, direct chat, menu hide/restore, all corners, drag, reload, keyboard, reduced motion');
} finally {
  await browser.close();
}
