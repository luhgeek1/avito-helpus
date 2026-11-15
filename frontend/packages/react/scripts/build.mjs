import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { styles } from "./styles.mjs";
import { copyLicenses } from "./licenses.mjs";

const pkg = fileURLToPath(new URL('..', import.meta.url));
const frontend = path.resolve(pkg, '../..');
const src = path.join(frontend, 'src');
const dist = path.join(pkg, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const styling = await styles(frontend);
const result = await build({
  entryPoints: [path.join(pkg, 'src/index.tsx')], outfile: path.join(dist, 'index.js'), bundle: true,
  platform: 'browser', format: 'esm', target: ['es2022'], jsx: 'automatic', minify: true, metafile: true,
  banner: { js: '"use client";' }, legalComments: 'linked', external: ['react', 'react-dom', 'react/*', 'react-dom/*'],
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: { '@/shared/api': path.join(src, 'shared/api/orbi/index.ts'),
    '@/shared/lib/portal-navigation': path.join(pkg, 'src/navigation.tsx'), '@': src },
  plugins: [{ name: 'orbi-runtime', setup(builder) {
    builder.onResolve({ filter: /^\.\/(http|session)$/ }, (args) => {
      if (args.resolveDir === path.join(src, 'shared/api/orbi')) return { path: path.join(pkg, `src/${args.path.slice(2)}.ts`) };
    });
    builder.onResolve({ filter: /^orbi:styles$/ }, () => ({ path: 'styles', namespace: 'orbi' }));
    builder.onLoad({ filter: /.*/, namespace: 'orbi' }, () => ({ contents: `export const css=${JSON.stringify(styling.css)};export const fonts=${JSON.stringify(styling.fonts)};`, loader: 'js' }));
  } }],
});
const inputs = Object.keys(result.metafile.inputs);
if (inputs.some((name) => /node_modules\/(next|msw|react|react-dom)\//.test(name))) throw new Error('Host framework or mocks leaked into the package');
await writeFile(path.join(dist, 'build-meta.json'), JSON.stringify({ inputs: inputs.length, bytes: result.metafile.outputs[path.relative(process.cwd(), path.join(dist, 'index.js'))]?.bytes }, null, 2));
// The public declarations depend only on React; internal FSD imports never enter the contract.
const options = { declaration: true, emitDeclarationOnly: true, strict: true, skipLibCheck: true,
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
const program = ts.createProgram([path.join(pkg, 'src/types.ts')], options);
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCanonicalFileName: (f) => f, getCurrentDirectory: () => frontend, getNewLine: () => '\n',
}));
program.emit(undefined, (file, content) => { if (file.endsWith('types.d.ts')) ts.sys.writeFile(path.join(dist, 'types.d.ts'), content); });
await writeFile(path.join(dist, 'index.d.ts'), `import type { ReactElement } from 'react';\nimport type { OrbiCompanionProps } from './types.js';\nexport type { OrbiCompanionProps, OrbiHandle, OrbiTokenProvider } from './types.js';\nexport declare function OrbiCompanion(props: OrbiCompanionProps): ReactElement;\n`);
await copyLicenses(frontend, dist);
for (const name of ['Golos-OFL.txt', 'OFL.txt']) await cp(path.join(frontend, 'public/fonts', name), path.join(dist, 'licenses', name));
console.log(`Built ${JSON.parse(await readFile(path.join(pkg, 'package.json'), 'utf8')).name}: ${inputs.length} modules, isolated CSS and fonts`);
