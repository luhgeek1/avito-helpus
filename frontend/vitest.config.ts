import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "jsdom", environmentOptions: { jsdom: { url: "http://localhost:5173" } },
    setupFiles: ["./tests/portal/setup.ts"], include: ["tests/**/*.test.{ts,tsx}"],
    coverage: { provider: "v8", reporter: ["text", "html", "json-summary"] },
  },
});
