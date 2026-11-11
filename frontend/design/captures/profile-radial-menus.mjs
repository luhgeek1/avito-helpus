import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';

const tag = process.argv[2] ?? 'before';
const url = process.env.RADIAL_URL ?? 'http://localhost:5173/';
const browser = await chromium.launch();
const reports = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => localStorage.setItem('buddy-pet', 'orbit'));
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(url, { waitUntil: 'networkidle' });
    for (const menu of ['actions', 'wardrobe']) {
      if (menu === 'wardrobe') {
        await page.locator('.widget-pet').click(); await page.waitForTimeout(450);
      }
      await page.evaluate(menu => {
        window.radialProbe = null;
        const trigger = menu === 'actions' ? '.widget-pet' : '[aria-label="Гардероб"]';
        const selector = menu === 'actions' ? '.orbit-action' : '.wardrobe-pet';
        const begin = event => {
          if (!event.target.closest(trigger)) return;
          document.removeEventListener('click', begin, true);
          const start = performance.now(), frames = [], transitions = [], tasks = [];
          const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(entry => ({ start: entry.startTime - start, duration: entry.duration }))));
          observer.observe({ type: 'longtask', buffered: false });
          const transition = event => {
            if (!event.target.matches(`${selector}, ${selector} .radial-reveal`)) return;
            transitions.push({ type: event.type, property: event.propertyName, time: performance.now() - start, elapsed: event.elapsedTime });
          };
          for (const type of ['transitionstart', 'transitionend', 'transitioncancel']) document.addEventListener(type, transition, true);
          const sample = () => {
            const time = performance.now();
            frames.push({ time: time - start });
            if (time - start < 650) requestAnimationFrame(sample);
            else {
              observer.disconnect();
              for (const type of ['transitionstart', 'transitionend', 'transitioncancel']) document.removeEventListener(type, transition, true);
              window.radialProbe = { frames, transitions, tasks };
            }
          };
          requestAnimationFrame(sample);
        };
        document.addEventListener('click', begin, true);
      }, menu);
      await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReturnAsStream' });
      if (menu === 'actions') await page.locator('.widget-pet').click();
      else await page.getByRole('button', { name: 'Гардероб', exact: true }).click();
      await page.waitForFunction(() => window.radialProbe !== null);
      const complete = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
      await cdp.send('Tracing.end');
      const { stream } = await complete;
      let trace = '';
      while (true) {
        const part = await cdp.send('IO.read', { handle: stream }); trace += part.data;
        if (part.eof) break;
      }
      await cdp.send('IO.close', { handle: stream });
      const events = JSON.parse(trace).traceEvents;
      const data = await page.evaluate(() => window.radialProbe);
      const gaps = data.frames.slice(1).map((frame, i) => frame.time - data.frames[i].time).sort((a, b) => a - b);
      const painting = Object.fromEntries(['Paint', 'RasterTask', 'UpdateLayoutTree', 'Layout'].map(name => {
        const selected = events.filter(event => event.name === name && event.ph === 'X');
        return [name, { count: selected.length, totalMs: +(selected.reduce((sum, event) => sum + event.dur, 0) / 1000).toFixed(2) }];
      }));
      const report = { width, menu, cpuSlowdown: 4, firstFrameMs: +data.frames[0].time.toFixed(2),
        p95GapMs: +gaps[Math.floor(gaps.length * .95)].toFixed(2), maxGapMs: +gaps.at(-1).toFixed(2),
        cancelledTransforms: data.transitions.filter(event => event.type === 'transitioncancel' && event.property === 'transform').length,
        painting, ...data };
      reports.push(report);
      console.log(JSON.stringify({ width, menu, firstFrameMs: report.firstFrameMs, p95GapMs: report.p95GapMs,
        cancelledTransforms: report.cancelledTransforms, painting, tasks: data.tasks }));
      await page.keyboard.press('Escape'); await page.waitForTimeout(450);
    }
    await context.close();
  }
  await writeFile(`frontend/design/captures/radial-performance-${tag}.json`, JSON.stringify({ url, reports }, null, 2));
} finally { await browser.close(); }
