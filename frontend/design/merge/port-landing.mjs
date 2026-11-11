import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const source = '/private/tmp/avito-helpus-landing-preview/frontend';
const target = path.join(root, 'frontend');
const require = createRequire(path.join(target, 'package.json'));
const postcss = require('postcss');
const mapping = new Map();
const keyframes = {}, animations = {};
const add = (from, to) => mapping.set(`src/${from}`, `src/${to}`);
for (const name of ['client', 'queries', 'schemas']) add(`api/${name}.ts`, `shared/api/portal/${name}.ts`);
for (const name of ['browser', 'data', 'db', 'handlers']) add(`mocks/${name}.ts`, `shared/api/portal/mocks/${name}.ts`);
add('stores/preferences.ts', 'entities/portal/model/preferences.ts');
add('lib/format.ts', 'shared/lib/portal-format/index.ts');
for (const file of await readdir(path.join(source, 'src/pages'))) add(`pages/${file}`, `_pages/portal/ui/${file.replace('.module.css', '.styles.tsx')}`);
for (const group of ['ui', 'layout', 'feed']) for (const file of await readdir(path.join(source, `src/components/${group}`))) {
  const directory = group === 'ui' ? 'shared/ui/portal' : `widgets/portal-${group === 'layout' ? 'shell' : group}/ui`;
  add(`components/${group}/${file}`, `${directory}/${file.replace('.module.css', '.styles.tsx')}`);
}
add('api/client.test.ts', '../tests/portal/client.test.ts');
add('mocks/handlers.test.ts', '../tests/portal/handlers.test.ts');
add('lib/format.test.ts', '../tests/portal/format.test.ts');
add('app/app.test.tsx', '../tests/portal/app.test.tsx');
add('test/setup.ts', '../tests/portal/setup.ts');
add('test/render.tsx', '../tests/portal/render.tsx');

async function save(file, value) {
  const destination = path.join(target, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, value);
}
function token(value) { return value.trim().replaceAll('_', '\\_').replace(/\s+/g, '_'); }
function compileStyle(text, prefix, global = false) {
  const parsed = postcss.parse(text), classes = new Map();
  const marker = name => global && name !== 'root' ? name : `hub-${prefix}-${name}`;
  parsed.walkAtRules('keyframes', rule => {
    const name = `hub-${prefix}-${rule.params}`;
    keyframes[name] = {};
    rule.each(frame => {
      if (frame.type !== 'rule') return;
      keyframes[name][frame.selector] = Object.fromEntries(frame.nodes.filter(node => node.type === 'decl').map(node => [node.prop.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), node.value]));
    });
  });
  parsed.walkRules(rule => {
    if (rule.parent.type === 'atrule' && rule.parent.name === 'keyframes') return;
    const medias = [];
    let ancestor = rule.parent;
    while (ancestor?.type !== 'root') {
      if (ancestor?.type === 'atrule') medias.unshift(ancestor.name === 'media' && /^\(max-width: (1100|1000|900|720)px\)$/.test(ancestor.params) ? `hub-max-${ancestor.params.match(/\d+/)[0]}` : `[@${ancestor.name}(${token(ancestor.params.replace(/^\(|\)$/g, ''))})]`);
      ancestor = ancestor?.parent;
    }
    for (let selector of postcss.list.comma(rule.selector)) {
      if (global) {
        if (selector === ':root' || selector === 'html' || selector === 'body') selector = '.root';
        else if (!selector.startsWith('.')) selector = `.root :where(${selector})`;
      }
      const first = selector.match(/^\.([\w-]+)/)?.[1];
      if (!first) throw new Error(`Unanchored selector: ${selector}`);
      const output = classes.get(first) ?? new Set([marker(first)]);
      classes.set(first, output);
      const scoped = selector.replace(/\.([a-zA-Z][\w-]*)/g, (_, name) => `.${marker(name)}`);
      const variant = [...medias, `[${medias.some(media => media.startsWith('hub-max-')) ? '&&' : '&'}${token(scoped)}]`].join(':');
      rule.each(declaration => {
        if (declaration.type !== 'decl') return;
        let value = declaration.value;
        if (global && declaration.prop === 'font-family') value = 'var(--font-portal),Arial,Helvetica,sans-serif';
        if (declaration.prop === 'animation') {
          const match = value.match(/^([\w-]+)\s/);
          if (match && keyframes[`hub-${prefix}-${match[1]}`]) {
            const name = `hub-${prefix}-${match[1]}`;
            animations[name] = value.replace(match[1], name);
            output.add(`${variant}:animate-${name}`);
            return;
          }
        }
        output.add(`${variant}:[${declaration.prop}:${token(value)}]${declaration.important ? '!' : ''}`);
      });
    }
  });
  const entries = [...classes].map(([name, values]) => `  ${JSON.stringify(name)}: ${JSON.stringify([...values].join(' '))},`);
  return `const styles = {\n${entries.join('\n')}\n};\nexport default styles;\n`;
}

await save('src/shared/ui/portal/global.styles.tsx', compileStyle(await readFile(path.join(source, 'src/index.css'), 'utf8'), 'global', true));
const slice = destination => destination.match(/^src\/(?:_pages|widgets|entities)\/[^/]+/)?.[0]
  ?? destination.match(/^src\/shared\/(?:api|ui|lib)\/[^/]+/)?.[0];
const publicApi = destination => {
  if (destination.includes('/shared/api/portal/mocks/')) return '@/shared/api/portal/testing';
  if (destination.startsWith('src/shared/api/portal/')) return '@/shared/api/portal';
  if (destination.startsWith('src/shared/ui/portal/')) return '@/shared/ui/portal';
  if (destination.startsWith('src/shared/lib/portal-format/')) return '@/shared/lib/portal-format';
  if (destination.startsWith('src/entities/portal/')) return '@/entities/portal';
  if (destination.startsWith('src/widgets/portal-feed/')) return '@/widgets/portal-feed';
  if (destination.startsWith('src/widgets/portal-shell/')) return '@/widgets/portal-shell';
  return null;
};
for (const [from, destination] of mapping) {
  if (from === 'src/test/render.tsx') continue;
  let content = await readFile(path.join(source, from), 'utf8');
  if (from.endsWith('.css')) {
    const prefix = path.basename(from, '.module.css');
    await save(destination, compileStyle(content, prefix));
    continue;
  }
  content = content.replace(/(from\s*['"])([^'"]+)(['"])/g, (match, before, specifier, after) => {
    if (specifier === '@tanstack/react-router') return `${before}@/shared/lib/portal-navigation${after}`;
    if (!specifier.startsWith('.')) return match;
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
    const original = [resolved, `${resolved}.ts`, `${resolved}.tsx`, `${resolved}/index.tsx`, `${resolved}/index.ts`].find(file => mapping.has(file));
    if (!original) throw new Error(`Unmapped import ${from}: ${specifier}`);
    const next = mapping.get(original);
    const api = slice(destination) !== slice(next) ? publicApi(next) : null;
    let relative = path.posix.relative(path.posix.dirname(destination), next).replace(/\.(tsx?|css)$/, '');
    if (!relative.startsWith('.')) relative = `./${relative}`;
    return `${before}${api ?? relative}${after}`;
  });
  content = content.replaceAll('import.meta.env.VITE_API_BASE_URL', 'process.env.NEXT_PUBLIC_API_BASE_URL')
    .replaceAll('import.meta.env.MODE', 'process.env.NODE_ENV');
  let globals = false;
  content = content.replace(/`palette-\$\{([^}]+)\}`/g, (_, value) => { globals = true; return `portalGlobals[\`palette-\${${value}}\`]`; });
  content = content.replace(/`container /g, () => { globals = true; return '`${portalGlobals.container} '; });
  content = content.replace(/className="visually-hidden"/g, () => { globals = true; return 'className={portalGlobals["visually-hidden"]}'; });
  if (from.endsWith('/Layout.tsx')) {
    content = content.replace("import { Outlet } from '@/shared/lib/portal-navigation'", "import type { ReactNode } from 'react'");
    content = content.replace('export function Layout()', 'export function Layout({ children }: { children: ReactNode })')
      .replace('<div className={s.shell}>', '<div className={`${portalGlobals.root} ${s.shell} isolate bg-white`}>')
      .replace('<Outlet />', '{children}');
    globals = true;
  }
  if (globals) {
    const module = slice(destination) === 'src/shared/ui/portal' ? './global.styles' : '@/shared/ui/portal';
    content = `import ${module === './global.styles' ? 'portalGlobals' : '{ portalGlobals }'} from '${module}'\n${content}`;
  }
  await save(destination, content);
}
await save('src/entities/portal/index.ts', "export { usePreferences, DEFAULT_QUICK_ACTIONS } from './model/preferences';\n");
await save('src/shared/api/portal/index.ts', "export * from './schemas';\nexport * from './queries';\nexport { api, ApiError, request } from './client';\nexport { startPortalMocks } from './start-mocks';\n");
await save('src/shared/api/portal/testing.ts', "export { handlers } from './mocks/handlers';\nexport { db, resetDb } from './mocks/db';\n");
await save('src/widgets/portal-shell/index.ts', "export { Layout as PortalShell } from './ui/Layout';\n");
await save('src/widgets/portal-feed/index.ts', "export { ChannelList, subscribersLabel } from './ui/ChannelList';\nexport { PostCard, postGridClass, ChannelAvatar, LikeButton, LikeButtonLarge } from './ui/PostCard';\n");
await save('src/_pages/portal/index.ts', '"use client";\n' + ['Home', 'Services', 'Service', 'Benefits', 'Events', 'Feed', 'Article', 'Profile', 'Search', 'Ai', 'NotFound'].map(name => `export { ${name}Page } from './ui/${name}Page';`).join('\n') + '\n');
const config = path.join(target, 'tailwind.config.ts');
let configText = execFileSync('git', ['show', 'HEAD:frontend/tailwind.config.ts'], { cwd: root, encoding: 'utf8' });
configText = configText.replace('"keyframes": {', `"keyframes": {\n${Object.entries(keyframes).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)},`).join('\n')}`);
configText = configText.replace('"animation": {', `"animation": {\n${Object.entries(animations).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)},`).join('\n')}`);
await writeFile(config, configText);
const ui = path.join(target, 'src/shared/ui/portal/index.tsx');
await writeFile(ui, await readFile(ui, 'utf8') + "\nexport { default as portalGlobals } from './global.styles';\nexport { ServiceIcon, SERVICE_EMOJI } from './ServiceIcon';\n");
console.log(`Ported ${mapping.size} source files; ${Object.keys(keyframes).length} keyframe animations.`);
