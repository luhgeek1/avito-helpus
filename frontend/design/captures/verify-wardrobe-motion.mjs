import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile, rename } from 'node:fs/promises';

const browser = await chromium.launch();
const reports = [], errors = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 },
      recordVideo: { dir: 'frontend/design/captures', size: { width, height: 844 } } });
    await context.addInitScript(() => {
      localStorage.setItem('buddy-pet', 'orbit');
      localStorage.setItem('buddy-favorites', '["orbit","orbi-neo"]');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.locator('.widget-pet').click();
    await page.getByRole('button', { name: 'Гардероб', exact: true }).click();
    await page.waitForFunction(() => document.activeElement?.id === 'companion-wardrobe');
    await page.screenshot({ path: `frontend/design/captures/wardrobe-smooth-${width}.png` });
    const samples = await page.evaluate(async () => {
      const root = document.querySelector('#companion-wardrobe');
      const pet = document.querySelector('.wardrobe-pet[data-pet-id="orbit"]');
      const samples = [], start = performance.now();
      const step = () => root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      step();
      const second = setTimeout(step, 110), third = setTimeout(step, 220);
      await new Promise(resolve => {
        function sample(time) {
          const matrix = new DOMMatrixReadOnly(pet.style.transform);
          let angle = Math.atan2(matrix.m42, matrix.m41) * 180 / Math.PI;
          if (samples.length) {
            const previous = samples.at(-1).angle;
            while (angle - previous > 180) angle -= 360;
            while (angle - previous < -180) angle += 360;
          }
          samples.push({ time: time - start, angle });
          if (time - start < 1050) requestAnimationFrame(sample); else resolve();
        }
        requestAnimationFrame(sample);
      });
      clearTimeout(second); clearTimeout(third);
      return samples;
    });
    const moving = samples.filter(sample => sample.time >= 70 && sample.time <= 370);
    const direction = Math.sign(moving.at(-1).angle - moving[0].angle);
    let longestHold = 0, holdStart = moving[0].time;
    for (let i = 1; i < moving.length; i++) {
      if (Math.abs(moving[i].angle - moving[i - 1].angle) > .001) holdStart = moving[i].time;
      longestHold = Math.max(longestHold, moving[i].time - holdStart);
      assert((moving[i].angle - moving[i - 1].angle) * direction >= -.001, 'Arc must move monotonically');
    }
    assert(longestHold < 60, `Unexpected pause: ${longestHold}ms`);
    assert.equal(await page.locator('.wardrobe-pet[data-center=true]').getAttribute('data-pet-id'), 'orbi-plum');
    await page.screenshot({ path: `frontend/design/captures/wardrobe-smooth-after-${width}.png` });
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(70);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(800);
    assert.equal(await page.locator('.wardrobe-pet[data-center=true]').getAttribute('data-pet-id'), 'orbi-plum');
    assert.equal(await page.evaluate(() => localStorage.getItem('buddy-pet')), 'orbit');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('buddy-favorites'))), ['orbit', 'orbi-neo']);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const video = page.video();
    await context.close();
    await rename(await video.path(), `frontend/design/captures/wardrobe-smooth-${width}.webm`);
    reports.push({ width, longestHoldMs: longestHold, samples, retargeting: true, reverse: true });
  }
  assert.deepEqual(errors, []);
  await writeFile('frontend/design/captures/wardrobe-motion-verification.json', JSON.stringify({ reports, errors }, null, 2));
  console.log('PASS: continuous motion, repeated input, reverse, desktop/mobile videos, preserved preferences');
} finally { await browser.close(); }
