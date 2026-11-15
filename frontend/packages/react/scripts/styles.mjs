import { readFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

/** Compile existing utilities once; consumers do not install or configure Tailwind. */
export async function styles(frontend) {
  const input = `@import "tailwindcss" source(none);\n@config "${frontend}/tailwind.config.ts";\n`
    + ['src/entities/pet', 'src/features', 'src/widgets/pet-companion', 'src/shared/ui/code-block', 'packages/react/src']
      .map((source) => `@source "${frontend}/${source}";`).join('\n');
  const result = await postcss([tailwind({ base: frontend, optimize: true })]).process(input, {
    from: path.join(frontend, 'orbi-sdk.generated.css'),
  });
  const root = postcss.parse(result.css);
  root.walkRules((rule) => { rule.selector = rule.selector.replace(/\bbody\b/g, '.orbi-surface'); });
  // Host rem units and inherited typography must not resize the companion.
  root.walkDecls((decl) => { decl.value = decl.value.replace(/(-?[\d.]+)rem\b/g, (_, n) => `${Number(n) * 16}px`); });
  const defaults = [];
  root.walkAtRules('property', (rule) => {
    const initial = rule.nodes.find((node) => node.prop === 'initial-value');
    if (initial) defaults.push(`${rule.params}:${initial.value}`);
  });
  const css = `*,::before,::after{${defaults.join(';')}}` + root.toString() + `\n:host{all:initial;display:block;position:fixed;top:0;left:0;width:0;height:0;direction:ltr;color-scheme:light;--font-golos:OrbiSDKGolos;--font-pixel:OrbiSDKPixel;--font-portal:OrbiSDKGolos}.orbi-surface{font-synthesis:none;text-rendering:optimizeLegibility}`;
  let fonts = '';
  for (const [family, file, weight] of [['OrbiSDKGolos', 'golos-text.woff2', '400 900'], ['OrbiSDKPixel', 'press-start-2p.woff2', '400']]) {
    const data = (await readFile(path.join(frontend, 'public/fonts', file))).toString('base64');
    fonts += `@font-face{font-family:${family};src:url(data:font/woff2;base64,${data}) format("woff2");font-weight:${weight};font-display:swap}`;
  }
  return { css, fonts };
}
