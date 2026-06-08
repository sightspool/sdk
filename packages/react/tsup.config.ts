import { defineConfig } from "tsup";
import { readFile, writeFile } from "node:fs/promises";

// React bindings — ESM + CJS + types. react / react/jsx-runtime / @sightspool/sdk are
// peer deps, so they're external (never bundled).
//
// "use client": esbuild strips a module-level directive when bundling (incl. via the
// `banner` option), so we prepend it to the final JS in onSuccess instead. It marks the
// output as a client module so it drops straight into a Next.js App Router server tree.
const USE_CLIENT = '"use client";\n';

export default defineConfig({
  entry: { index: "src/index.tsx" },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: "es2018",
  external: ["react", "react/jsx-runtime", "@sightspool/sdk"],
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
  async onSuccess() {
    for (const file of ["dist/index.js", "dist/index.cjs"]) {
      const src = await readFile(file, "utf8");
      if (!src.startsWith('"use client"')) await writeFile(file, USE_CLIENT + src);
    }
  },
});
