import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
export async function copyLicenses(frontend, dist) {
  await mkdir(path.join(dist, 'licenses'), { recursive: true });
  for (const [name, license] of [
    ['lucide-react', 'LICENSE'], ['tailwind-merge', 'LICENSE.md'], ['zustand', 'LICENSE'],
    ['zod', 'LICENSE'], ['@tanstack/react-query', 'LICENSE'], ['@tanstack/query-core', 'LICENSE'],
  ]) {
    await cp(path.join(frontend, 'node_modules', name, license), path.join(dist, 'licenses', `${name.replaceAll('/', '-')}.txt`));
  }
}
