import { chromium } from '/Users/stepanvasiliev/.codex/skills/design-studio/scripts/node_modules/playwright/index.mjs';
import { writeFile } from 'node:fs/promises';

const tag = process.argv[2] ?? 'before';
const url = process.env.WARDROBE_URL ?? 'http://127.0.0.1:5184/';
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    await context.addInitScript(() => localStorage.setItem('buddy-pet', 'orbit'));
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await cdp.send('Performance.enable');
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('.widget-pet').click();
    const trigger = page.getByRole('button', { name: 'Гардероб', exact: true });
    await trigger.waitFor(); await page.waitForTimeout(450);
    await page.evaluate(() => {
      window.wardrobePerf = { frames: [], longTasks: [], addedNodes: 0, start: performance.now() };
      const sample = time => { window.wardrobePerf.frames.push(time); window.wardrobePerf.frame = requestAnimationFrame(sample); };
      window.wardrobePerf.frame = requestAnimationFrame(sample);
      window.wardrobePerf.long = new PerformanceObserver(list => {
        window.wardrobePerf.longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })));
      });
      window.wardrobePerf.long.observe({ type: 'longtask', buffered: false });
      window.wardrobePerf.mutations = new MutationObserver(records => {
        for (const record of records) for (const node of record.addedNodes) {
          if (node.nodeType === 1) window.wardrobePerf.addedNodes += 1 + node.querySelectorAll('*').length;
        }
      });
      window.wardrobePerf.mutations.observe(document.querySelector('#companion-wardrobe'), { childList: true, subtree: true });
    });
    const before = (await cdp.send('Performance.getMetrics')).metrics;
    await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
    await trigger.click();
    await page.waitForTimeout(650);
    const openingEnd = await page.evaluate(() => performance.now());
    await page.evaluate(async () => {
      const root = document.querySelector('#companion-wardrobe');
      for (let i = 0; i < 24; i++) {
        root.dispatchEvent(new KeyboardEvent('keydown', { key: i < 16 ? 'ArrowRight' : 'ArrowLeft', bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 70));
      }
    });
    await page.waitForTimeout(850);
    const { profile } = await cdp.send('Profiler.stop');
    const after = (await cdp.send('Performance.getMetrics')).metrics;
    const samples = await page.evaluate(() => {
      const data = window.wardrobePerf;
      cancelAnimationFrame(data.frame); data.long.disconnect(); data.mutations.disconnect();
      const root = document.querySelector('#companion-wardrobe');
      return { frames: data.frames, longTasks: data.longTasks, addedNodes: data.addedNodes,
        domNodes: root.querySelectorAll('*').length, rects: root.querySelectorAll('rect').length };
    });
    const stats = frames => {
      const gaps = frames.slice(1).map((time, i) => time - frames[i]).sort((a, b) => a - b);
      return { frames: frames.length, p95GapMs: +gaps[Math.floor(gaps.length * .95)].toFixed(2),
        maxGapMs: +gaps.at(-1).toFixed(2), gapsOver25ms: gaps.filter(gap => gap > 25).length };
    };
    const delta = Object.fromEntries(['ScriptDuration', 'TaskDuration', 'LayoutDuration', 'RecalcStyleDuration'].map(name =>
      [name, +(after.find(item => item.name === name).value - before.find(item => item.name === name).value).toFixed(4)]));
    const times = new Map(), nodes = new Map(profile.nodes.map(node => [node.id, node]));
    profile.samples?.forEach((id, i) => {
      const frame = nodes.get(id).callFrame;
      const key = `${frame.functionName || '(anonymous)'} ${frame.url.split('/').at(-1)}:${frame.lineNumber}`;
      times.set(key, (times.get(key) ?? 0) + profile.timeDeltas[i] / 1000);
    });
    const result = { width, cpuSlowdown: 4, ...samples, opening: stats(samples.frames.filter(time => time <= openingEnd)),
      scrolling: stats(samples.frames.filter(time => time > openingEnd)), delta,
      topFunctions: [...times].sort((a, b) => b[1] - a[1]).slice(0, 12) };
    delete result.frames;
    results.push(result);
    console.log(JSON.stringify({ width, domNodes: result.domNodes, addedNodes: result.addedNodes,
      opening: result.opening, scrolling: result.scrolling, delta, longTasks: result.longTasks.length }));
    await context.close();
  }
  await writeFile(`frontend/design/captures/wardrobe-performance-${tag}.json`, JSON.stringify({ url, results }, null, 2));
} finally { await browser.close(); }
