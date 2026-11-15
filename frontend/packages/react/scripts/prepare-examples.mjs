import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const pkg = fileURLToPath(new URL('..', import.meta.url));
const directory = await mkdtemp(path.join(tmpdir(), 'orbi-sdk-consumers-'));
const tarball = path.join(pkg, 'dist/orbi-companion-react-0.1.0.tgz');
for (const name of ['vite', 'next']) {
  const app = path.join(directory, name);
  await cp(path.join(pkg, 'examples', name), app, { recursive: true, filter: (file) => !/node_modules|\.next|dist/.test(file) });
  const manifest = JSON.parse(await readFile(path.join(app, 'package.json'), 'utf8'));
  manifest.dependencies['@orbi-companion/react'] = `file:${tarball}`;
  await writeFile(path.join(app, 'package.json'), JSON.stringify(manifest, null, 2));
  for (const args of [['install', '--no-audit', '--no-fund'], ['run', 'build']]) {
    const result = spawnSync('npm', args, { cwd: app, stdio: 'inherit' });
    if (result.status) process.exit(result.status);
  }
}
await writeFile(path.join(pkg, 'dist/consumers.json'), JSON.stringify({ directory }));
console.log(`Independent consumers: ${directory}`);
