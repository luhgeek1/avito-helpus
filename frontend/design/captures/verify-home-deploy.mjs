import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/laughinme/.agents/skills/design-studio/scripts/node_modules/playwright/index.mjs');
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5180';
const prefix = process.env.CAPTURE_PREFIX ?? 'home-deploy';
const output = name => fileURLToPath(new URL(`./${prefix}-${name}`, import.meta.url));
const browser = await chromium.launch({ headless: true });
const results = [];
const errors = [];

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => {
      localStorage.setItem('buddy-onboarding-v1', 'done');
      localStorage.setItem('buddy-pet', 'orbit');
      localStorage.setItem('buddy-favorites', '["orbit"]');
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const health = await context.request.get(`${base}/healthz`);
    assert.equal(health.status(), 200);
    assert.deepEqual(await health.json(), { status: 'ok' });

    for (const route of ['/', '/services', '/pets?pet=orbit']) {
      const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200, route);
      await page.locator('.companion').waitFor();
      await page.waitForFunction(() => [...document.images].every(image => image.complete));
      assert.deepEqual(await page.locator('img').evaluateAll(images => images.filter(image => !image.naturalWidth).map(image => image.src)), []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, route);
      if (route.startsWith('/pets')) {
        assert.equal(await page.locator('.pet-card').count(), 16);
        assert.match(await page.locator('.detail-name h2').innerText(), /Орби/);
        assert.equal(await page.locator('.pet-detail .pixel-pet').getAttribute('viewBox'), '0 0 32 32');
        await page.getByRole('button', { name: 'Избранные · 1', exact: true }).waitFor();
      } else {
        assert.ok((await page.locator('main').innerText()).trim().length > 100);
      }
      const name = route === '/' ? 'home' : route.startsWith('/pets') ? 'pets' : 'services';
      await page.screenshot({ path: output(`${name}-${width}.png`), fullPage: false });
      results.push({ width, route, status: response.status(), noBrokenImages: true, noOverflow: true });
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(output('verification.json'), JSON.stringify({ base, results, errors }, null, 2));
  console.log(`PASS: ${base}, desktop/mobile, health, portal mocks, assets, orbit query and favorites`);
} finally {
  await browser.close();
}
