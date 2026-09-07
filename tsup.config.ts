import { defineConfig } from "tsup";

// npm (ESM/CJS/types) and the script-tag bundle share the research runtime.
// Parked capture modules are intentionally absent from both dependency graphs.
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
    entry: { sdk: "src/browser.ts" },
    format: ["iife"],
    globalName: "Sightspool",
    sourcemap: true,
    minify: true,
    treeshake: true,
    target: "es2018",
  },
]);
