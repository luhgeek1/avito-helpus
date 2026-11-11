import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch();
const reports = [];
try {
  for (const mode of ['production', 'development']) for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => localStorage.setItem('buddy-pet', 'orbit'));
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(`http://127.0.0.1:${mode === 'production' ? 5185 : 5173}/`, { waitUntil: 'networkidle' });
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.locator('.widget-pet').click();
      await page.waitForTimeout(450);
      await page.evaluate(() => {
        window.openingResult = null;
        const startProbe = event => {
          if (!event.target.closest('[aria-label="Гардероб"]')) return;
          document.removeEventListener('click', startProbe, true);
          const start = performance.now(), frames = [], longTasks = [];
          const observer = new PerformanceObserver(list => longTasks.push(...list.getEntries().map(entry => entry.duration)));
          observer.observe({ type: 'longtask', buffered: false });
          const sample = time => {
            frames.push(time);
            if (time - start < 550) requestAnimationFrame(sample);
            else {
              observer.disconnect();
              window.openingResult = { frames, longTasks };
            }
          };
          requestAnimationFrame(sample);
        };
        document.addEventListener('click', startProbe, true);
      });
      await page.getByRole('button', { name: 'Гардероб', exact: true }).click();
      await page.waitForFunction(() => window.openingResult !== null);
      const samples = await page.evaluate(() => window.openingResult);
      const gaps = samples.frames.slice(1).map((time, i) => time - samples.frames[i]).sort((a, b) => a - b);
      const report = { mode, width, attempt, cpuSlowdown: 4, p95GapMs: +gaps[Math.floor(gaps.length * .95)].toFixed(2),
        maxGapMs: +gaps.at(-1).toFixed(2), longTasks: samples.longTasks };
      assert(report.maxGapMs < 100, JSON.stringify(report));
      reports.push(report);
      if (!attempt && mode === 'production') await page.screenshot({ path: `frontend/design/captures/wardrobe-optimized-${width}.png` });
      await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    }
    await context.close();
  }
  await writeFile('frontend/design/captures/wardrobe-opening-verification.json', JSON.stringify({ reports }, null, 2));
  console.log(JSON.stringify(reports));
} finally { await browser.close(); }
