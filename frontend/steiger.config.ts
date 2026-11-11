import { defineConfig } from "steiger";
import fsd from "@feature-sliced/steiger-plugin";

export default defineConfig([
  ...fsd.configs.recommended,
  {
    files: ["./src/_app/**", "./src/_pages/**"],
    // Next.js reserves app/pages; underscore-prefixed FSD layers avoid route discovery.
    rules: { "fsd/typo-in-layer-name": "off" },
  },
  {
    files: ["./src/features/**", "./src/widgets/**"],
    // One consumer is a design hint, not a dependency-boundary violation.
    // Keep it visible while the prototype has only one gallery screen.
    rules: { "fsd/insignificant-slice": "warn" },
  },
]);
