import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    maxWorkers: 2,
    environment: "jsdom", environmentOptions: { jsdom: { url: "http://localhost:5173" } },
    setupFiles: ["./tests/portal/setup.ts"], include: ["tests/**/*.test.{ts,tsx}"], exclude: ["tests/sdk/**"],
    coverage: {
      provider: "v8", reporter: ["text", "html", "json-summary"],
      // Every source file counts, including ones no test imports.
      include: ["src/**/*.{ts,tsx}"],
      thresholds: { lines: 100 },
    },
  },
});
