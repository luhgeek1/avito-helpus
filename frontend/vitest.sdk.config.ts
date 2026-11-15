import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL('.', import.meta.url));
const src = path.join(root, 'src');
const sdk = path.join(root, 'packages/react/src');
export default defineConfig({
  resolve: { alias: {
    '@/shared/api': path.join(src, 'shared/api/orbi/index.ts'),
    '@/shared/lib/portal-navigation': path.join(sdk, 'navigation.tsx'),
    'orbi:styles': path.join(root, 'tests/sdk/styles.ts'), '@': src,
  } },
  plugins: [{ name: 'sdk-runtime', enforce: 'pre', resolveId(id, importer) {
    if (/^\.\/(http|session)$/.test(id) && importer && path.normalize(path.dirname(importer)) === path.join(src, 'shared/api/orbi')) {
      return path.join(sdk, `${id.slice(2)}.ts`);
    }
  } }],
  test: { environment: 'jsdom', environmentOptions: { jsdom: { url: 'http://localhost:5173' } },
    include: ['tests/sdk/**/*.test.{ts,tsx}'], setupFiles: ['./tests/sdk/setup.ts'], maxWorkers: 2,
    coverage: { provider: 'v8', include: ['packages/react/src/**/*.{ts,tsx}'],
      reportsDirectory: 'coverage/sdk', reporter: ['text', 'json-summary'], thresholds: { lines: 100 } },
  },
});
