// Summarises a compare report: collapses derived/logical properties and groups by element.
import fs from 'fs';
const [file, mode = 'summary', filter] = process.argv.slice(2);
const report = JSON.parse(fs.readFileSync(file, 'utf8'));
const DERIVED = /^(border-(top|right|bottom|left)-color|border-(block|inline)-(start|end)-color|caret-color|column-rule-color|row-rule-color|outline-color|text-decoration-color|text-emphasis-color|-webkit-text-fill-color|-webkit-text-stroke-color|stroke|fill)$/;
const LOGICAL = /^(border-(block|inline)-|margin-(block|inline)|padding-(block|inline)|inset-(block|inline)|(max-|min-)?(inline|block)-size|(overflow|overscroll-behavior)-(block|inline)|contain-intrinsic-(block|inline)-size|scroll-(margin|padding)-(block|inline)|-webkit-(border-(before|after|start|end)|margin|padding)|border-(start|end)-)/;
const SIDES = /^(border-(right|bottom|left)-(style|width)|padding-(right|bottom|left)|margin-(right|bottom|left)|border-(top-right|bottom-right|bottom-left)-radius)$/;
const IGNORE = new Set(['transition-behavior', 'perspective-origin', 'transform-origin']);
// oklab()/rgb() colours compared in sRGB with 1/255 tolerance.
function toRgba(v) {
  let m = v.match(/^rgba?\(([\d.]+),? ([\d.]+),? ([\d.]+)(?:,? \/? ?([\d.]+))?\)$/);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  m = v.match(/^color\(srgb ([-\d.]+) ([-\d.]+) ([-\d.]+)(?: \/ ([\d.]+))?\)$/);
  if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] === undefined ? 1 : +m[4]];
  m = v.match(/^oklab\(([-\d.]+) ([-\d.]+) ([-\d.]+)(?: \/ ([\d.]+))?\)$/);
  if (m) {
    const [L, A, B] = [+m[1], +m[2], +m[3]];
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, mm = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const lin = [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s];
    const g = lin.map(c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
    return [...g, m[4] === undefined ? 1 : +m[4]];
  }
  return null;
}
function sameColor(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ca = toRgba(a), cb = toRgba(b);
  if (!ca || !cb) return false;
  return ca.slice(0, 3).every((v, i) => Math.abs(v - cb[i]) <= 1.5) && Math.abs(ca[3] - cb[3]) < 0.01;
}
const splitList = (v) => v.split(/,\s*(?![^(]*\))/);
const out = [];
const EXPECTED = {};
for (const page of report) {
  const byEl = new Map();
  for (const d of page.diffs) {
    const k = d.path + '|' + d.tag + '|' + (d.pseudo || '');
    if (!byEl.has(k)) byEl.set(k, []);
    byEl.get(k).push(d);
  }
  for (const [k, ds] of byEl) {
    const color = ds.find(d => d.prop === 'color');
    const rest = ds.filter(d => !(d.kind === 'style' && (LOGICAL.test(d.prop) || SIDES.test(d.prop) || IGNORE.has(d.prop) || (DERIVED.test(d.prop) && ((color && d.a === color.a && d.b === color.b) || d.tag === 'static' && d.prop === 'outline-color' && ds.some(x => x.prop === 'outline-style' && x.a === 'none' && x.b === 'none'))))));
    const EASE = { 'ease-out': 'cubic-bezier(0, 0, 0.2, 1)', 'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)', 'ease-in': 'cubic-bezier(0.4, 0, 1, 1)', ease: 'cubic-bezier(0.4, 0, 0.2, 1)' };
    const normEase = (v) => splitList(v || '').map(x => EASE[x] || x);
    const expected = (d) => {
      if (d.kind !== 'style') return null;
      if (sameColor(d.a, d.b)) return 'color-format';
      if (/^align-(items|self)$/.test(d.prop) && [d.a, d.b].sort().join() === 'flex-start,start') return 'keyword-alias';
      // Tailwind 4 uses the translate/rotate/scale properties; equal geometry means the same placement.
      const split = ds.some(x => x.prop === 'transform' && x.b === 'none') && !ds.some(x => x.kind === 'rect');
      if (split && (d.prop === 'transform' || /^(translate|rotate|scale)$/.test(d.prop))) return 'transform-split';
      if (d.prop === 'transition-property' && d.a.replace('transform', 'translate') === d.b) return 'transform-split';
      if (/^transition-(duration|delay)$/.test(d.prop) && new Set([...splitList(d.a), ...splitList(d.b)]).size === 1) return 'transition-list';
      if (d.prop === 'transition-timing-function' && new Set([...normEase(d.a), ...normEase(d.b)]).size === 1) return 'tailwind-ease';
      if (d.prop === 'box-shadow') { const clean = (v) => splitList(v).filter(x => !/^rgba\(0, 0, 0, 0\) 0px 0px 0px 0px$/.test(x)).join(', ') || 'none'; if (clean(d.a) === clean(d.b)) return 'shadow-layers'; }
      if (/^grid-(row|column)-(start|end)$|^grid-template-areas$/.test(d.prop) && !ds.some(x => x.kind === 'rect')) return 'grid-placement';
      if (d.prop === 'background-position' && /^0(px|%) 0(px|%)$/.test(d.a) && /^0(px|%) 0(px|%)$/.test(d.b)) return 'bg-position-0';
      return null;
    };
    const filtered = rest.filter(d => { const e = expected(d); if (e) { EXPECTED[e] = (EXPECTED[e] || 0) + 1; return false; } return true; });
    const tr = (d) => d.kind === 'style' && /^transition-(property|duration|delay|timing-function)$/.test(d.prop);
    const listA = (p) => splitList(ds.find(d => d.prop === p)?.a ?? ''), listB = (p) => splitList(ds.find(d => d.prop === p)?.b ?? '');
    const superset = ds.some(d => d.prop === 'transition-property') && listA('transition-property').every(x => listB('transition-property').includes(x))
      && ['transition-duration', 'transition-delay'].every(p => !ds.some(d => d.prop === p) || new Set([...listA(p), ...listB(p)]).size === 1)
      && (!ds.some(d => d.prop === 'transition-timing-function') || new Set([...normEase(ds.find(d => d.prop === 'transition-timing-function').a), ...normEase(ds.find(d => d.prop === 'transition-timing-function').b)]).size === 1);
    const final = filtered.filter(d => { if (superset && tr(d)) { EXPECTED['transition-colors'] = (EXPECTED['transition-colors'] || 0) + 1; return false; } return true; });
    if (!final.length) continue;
    rest.length = 0; rest.push(...final);
    out.push({ page: page.label, key: k, d: rest });
  }
}
if (mode === 'summary') {
  const agg = {};
  for (const e of out) for (const d of e.d) { const key = `${d.kind} ${d.prop || ''} [${d.tag}${d.pseudo ? ' ' + d.pseudo : ''}]`; agg[key] = (agg[key] || 0) + 1; }
  console.log(Object.entries(agg).sort((a, b) => b[1] - a[1]).map(x => x[1] + '\t' + x[0]).join('\n'));
  console.log('expected (hidden):', JSON.stringify(EXPECTED));
} else {
  const seen = new Set();
  for (const e of out) {
    const sig = e.key.replace(/\|.*/, '') + JSON.stringify(e.d.map(d => [d.prop, d.a, d.b]));
    if (filter && !JSON.stringify(e).includes(filter)) continue;
    if (seen.has(sig)) continue; seen.add(sig);
    const first = e.d[0];
    console.log(`\n# ${e.page} ${e.key.split('|').slice(1).join(' ')} ${e.key.split('|')[0].replace(/^html\/body\[\d\]\//, '')}\n  txt="${first.txt || ''}" cls="${(first.cls || '').slice(0, 160)}"`);
    for (const d of e.d.slice(0, 12)) console.log(`  ${d.kind} ${d.prop || ''}: ${JSON.stringify(d.a)} -> ${JSON.stringify(d.b)}`);
  }
}
