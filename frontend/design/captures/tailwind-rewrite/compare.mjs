// Element-by-element computed-style comparison between two running builds.
// Usage: node compare.mjs <baseUrl A> <baseUrl B> <out.json> [routeFilter] [--no-states]
import { chromium } from 'playwright-core';
import fs from 'fs';

const [A, B, OUT, FILTER, ...flags] = process.argv.slice(2);
const NO_STATES = flags.includes('--no-states') || FILTER === '--no-states';
const routeFilter = FILTER && !FILTER.startsWith('--') ? new RegExp(FILTER) : null;

const ROUTES = [
  '/', '/ai', '/benefits/health', '/benefits/savings', '/events', '/feed', '/feed/post-1', '/feed/post-3',
  '/illustrations', '/people/p-olga', '/pets', '/pets?pet=orbi-neo', '/profile', '/search?q=отпуск', '/services',
  '/services/booking', '/services/onboarding', '/nope-404',
];
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'tablet', width: 800, height: 1000 },
  { name: 'phone', width: 390, height: 844, mobile: true },
];
// "tour" = first visit with onboarding; "clean" = onboarding done.
const STATES = ['clean', 'tour'];
const FIXED_TIME = new Date('2026-11-12T10:00:00+03:00');

const SNAPSHOT = `(rootSel) => {
  const SKIP = new Set(['SCRIPT','STYLE','LINK','META','HEAD','TEMPLATE','NOSCRIPT','NEXTJS-PORTAL','TITLE','NEXT-ROUTE-ANNOUNCER']);
  const out = {};
  const root = rootSel ? document.querySelector(rootSel) : document.documentElement;
  const pathOf = (el) => { const parts = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { parts.unshift(e.tagName.toLowerCase() + '[' + Array.prototype.indexOf.call(e.parentElement.children, e) + ']'); } return 'html/' + parts.join('/'); };
  const read = (cs) => { const o = {}; for (let i = 0; i < cs.length; i++) { const p = cs[i]; if (p.startsWith('--')) continue; o[p] = cs.getPropertyValue(p); } return o; };
  const walk = (el) => {
    if (SKIP.has(el.tagName)) return;
    const path = pathOf(el);
    const r = el.getBoundingClientRect();
    const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').slice(0, 40);
    const rec = { tag: el.tagName, n: [...el.children].filter(c => !SKIP.has(c.tagName)).length, txt: own || (el.getAttribute('aria-label') || '').slice(0, 40), cls: (el.getAttribute('class') || '').slice(0, 300), rect: [r.x, r.y + window.scrollY, r.width, r.height].map(v => Math.round(v * 2) / 2), s: read(getComputedStyle(el)) };
    for (const pseudo of ['::before', '::after', '::placeholder', '::marker']) {
      if (pseudo === '::placeholder' && !('placeholder' in el && el.placeholder)) continue;
      if (pseudo === '::marker' && el.tagName !== 'LI') continue;
      const ps = getComputedStyle(el, pseudo);
      if ((pseudo === '::before' || pseudo === '::after') && (ps.content === 'none' || ps.content === 'normal')) continue;
      rec[pseudo] = read(ps);
    }
    out[path] = rec;
    for (const c of el.children) walk(c);
  };
  walk(root);
  return out;
}`;

// Paths of elements that are targets of :hover/:active/:focus-visible rules.
const STATE_TARGETS = `(pseudo) => {
  const sels = new Set();
  const visit = (rules, parent) => {
    for (const rule of rules) {
      let sel = parent;
      if (rule.selectorText !== undefined) {
        sel = rule.selectorText.split(',').map(s => s.trim()).flatMap(s => parent ? parent.split(',').map(p => s.includes('&') ? s.replaceAll('&', ':is(' + p.trim() + ')') : p.trim() + ' ' + s) : [s]).join(',');
        for (const part of sel.split(/,(?![^(]*\\))/)) {
          const i = part.indexOf(pseudo);
          if (i >= 0) sels.add(part.slice(0, i).replace(/:is\\($/, '') || '*');
        }
      }
      if (rule.cssRules) visit(rule.cssRules, sel);
    }
  };
  for (const sheet of document.styleSheets) { try { visit(sheet.cssRules, ''); } catch {} }
  const els = new Set();
  for (const s of sels) { try { document.querySelectorAll(s).forEach(e => els.add(e)); } catch {} }
  const pathOf = (el) => { const parts = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { parts.unshift(e.tagName.toLowerCase() + '[' + Array.prototype.indexOf.call(e.parentElement.children, e) + ']'); } return 'html/' + parts.join('/'); };
  return [...els].filter(e => e !== document.documentElement && e !== document.body && e.getClientRects().length).map(pathOf);
}`;

const SELECTOR_OF = (path) => 'html' + path.replace(/^html\/?/, '').split('/').filter(Boolean).map(p => ' > :nth-child(' + (+p.match(/\[(\d+)\]$/)[1] + 1) + ')').join('');

async function openPage(browser, base, route, vp, state) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, deviceScaleFactor: 1, locale: 'ru-RU', timezoneId: 'Europe/Moscow', reducedMotion: 'no-preference' });
  await ctx.addInitScript((st) => {
    try {
      if (st === 'clean') { localStorage.setItem('buddy-onboarding-v1', 'done'); localStorage.setItem('buddy-pet', 'orbit'); }
    } catch {}
  }, state);
  const page = await ctx.newPage();
  await page.clock.setFixedTime(FIXED_TIME);
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(700);
  await page.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 0; } catch {} } window.scrollTo(0, 0); });
  return { ctx, page };
}

const RADIUS = /radius/;
function diffRec(a, b, path, out, tag) {
  if (!a || !b) { out.push({ path, kind: 'missing', a: !!a, b: !!b, tag }); return; }
  if (a.tag !== b.tag || a.n !== b.n) out.push({ path, kind: 'structure', a: [a.tag, a.n], b: [b.tag, b.n], tag });
  const ra = a.rect, rb = b.rect;
  if (ra && rb && ra.some((v, i) => Math.abs(v - rb[i]) > 0.5)) out.push({ path, kind: 'rect', a: ra, b: rb, tag, txt: b.txt || a.txt, cls: b.cls });
  if (a.s?.display === 'none' && b.s?.display === 'none') return;
  for (const key of ['s', '::before', '::after', '::placeholder', '::marker']) {
    const sa = a[key], sb = b[key];
    if (!sa && !sb) continue;
    if (!sa || !sb) { out.push({ path, kind: 'pseudo', pseudo: key, a: !!sa, b: !!sb, tag }); continue; }
    for (const p of Object.keys(sa)) {
      if (sa[p] === sb[p]) continue;
      const bw = p.match(/^border-(top|right|bottom|left|block-start|block-end|inline-start|inline-end)-(?:style|color)$/);
      if (bw && sa[`border-${bw[1]}-width`] === '0px' && sb[`border-${bw[1]}-width`] === '0px') continue;
      if (/^outline-(color|width|offset)$/.test(p) && sa['outline-style'] === 'none' && sb['outline-style'] === 'none') continue;
      if (RADIUS.test(p) && ra) { const pa = parseFloat(sa[p]), pb = parseFloat(sb[p]); const half = Math.min(ra[2], ra[3]) / 2; if ((sa[p].includes('%') || pa >= half) && (sb[p].includes('%') || pb >= half) && Math.abs(ra[2] - ra[3]) < 1) continue; }
      out.push({ path, kind: 'style', pseudo: key === 's' ? undefined : key, prop: p, a: sa[p], b: sb[p], tag, txt: b.txt || a.txt, cls: b.cls });
    }
  }
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = [];
const routes = ROUTES.filter(r => !routeFilter || routeFilter.test(r));
for (const vp of VIEWPORTS.filter(v => !process.env.VP || process.env.VP.split(',').includes(v.name))) {
  for (const route of routes) {
    for (const state of STATES) {
      if (state === 'tour' && !['/', '/pets'].includes(route)) continue;
      const label = `${vp.name} ${route} ${state}`;
      const [pa, pb] = await Promise.all([openPage(browser, A, route, vp, state), openPage(browser, B, route, vp, state)]);
      const [sa, sb] = await Promise.all([pa.page.evaluate(`(${SNAPSHOT})(null)`), pb.page.evaluate(`(${SNAPSHOT})(null)`)]);
      const diffs = [];
      for (const path of new Set([...Object.keys(sa), ...Object.keys(sb)])) diffRec(sa[path], sb[path], path, diffs, 'static');
      if (!NO_STATES && ['desktop', 'phone'].includes(vp.name)) {
        const cdpA = await pa.ctx.newCDPSession(pa.page), cdpB = await pb.ctx.newCDPSession(pb.page);
        for (const cdp of [cdpA, cdpB]) { await cdp.send('DOM.enable'); await cdp.send('CSS.enable'); }
        for (const pseudo of ['hover', 'focus-visible', 'active', 'focus']) {
          const [ta, tb] = await Promise.all([pa.page.evaluate(`(${STATE_TARGETS})(':${pseudo}')`), pb.page.evaluate(`(${STATE_TARGETS})(':${pseudo}')`)]);
          const targets = [...new Set([...ta, ...tb])];
          for (const path of targets) {
            const sel = SELECTOR_OF(path);
            const snaps = [];
            for (const [cdp, page] of [[cdpA, pa.page], [cdpB, pb.page]]) {
              const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
              const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
              if (!nodeId) { snaps.push(null); continue; }
              const forced = pseudo === 'focus-visible' ? ['focus', 'focus-visible'] : [pseudo];
              await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: forced });
              await page.evaluate(() => { for (const a of document.getAnimations()) if (a instanceof CSSTransition) a.finish(); });
              snaps.push(await page.evaluate(`(${SNAPSHOT})(${JSON.stringify(sel)})`));
              await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
            }
            if (!snaps[0] || !snaps[1]) { diffs.push({ path, kind: 'missing', tag: pseudo }); continue; }
            for (const p of new Set([...Object.keys(snaps[0]), ...Object.keys(snaps[1])])) {
              const before = diffs.length;
              diffRec(snaps[0][p], snaps[1][p], p, diffs, pseudo);
              // Ignore diffs that already exist statically.
              for (let i = diffs.length - 1; i >= before; i--) {
                const d = diffs[i];
                if (diffs.some((s, j) => j < before && s.tag === 'static' && s.path === d.path && s.prop === d.prop && s.kind === d.kind && s.a === d.a && s.b === d.b)) diffs.splice(i, 1);
              }
            }
          }
        }
      }
      report.push({ label, count: diffs.length, diffs });
      console.log(label.padEnd(48), Object.keys(sa).length, 'els', diffs.length, 'diffs');
      await pa.ctx.close(); await pb.ctx.close();
    }
  }
}
await browser.close();
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
