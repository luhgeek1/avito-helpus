import { readFile } from 'node:fs/promises';
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (pkg.license === 'UNLICENSED') throw new Error('Choose the project license and add LICENSE before public publishing. npm pack is available now.');
if (!pkg.name.startsWith('@')) throw new Error('Use your npm account or organization scope.');
