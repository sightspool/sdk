import { defineConfig } from "tsup";

// Two artifacts from one source:
//   1. the npm package — ESM + CJS + .d.ts (for `import Sightspool from '@sightspool/sdk'`)
//   2. a standalone browser bundle — IIFE exposing window.Sightspool (the <script> install)
// Strict budget: the core is tiny; the prompt UI is the only heavy bit and it's
// dynamically imported so it splits into its own lazily-loaded chunk.
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: false,
    target: "es2018",
  },
  {
    entry: { sdk: "src/index.ts" },
    format: ["iife"],
    globalName: "Sightspool",
    sourcemap: true,
    minify: true,
    treeshake: true,
    target: "es2018",
  },
]);
