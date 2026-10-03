import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { rm } from "node:fs/promises";

// Plain `tsc` output can't actually run under Electron: this monorepo's
// tsconfig.base.json compiles with moduleResolution "bundler", so emitted
// relative imports (e.g. "./types") omit the .js extension Node's real ESM
// loader requires. api-server/build.mjs solved this the same way for its
// own Node entrypoint; this mirrors that, not a new pattern (Cross-App
// Control Phase 0, khameleon-decisions-log.md, 2026-10-03).
const here = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(here, "dist");
  await rm(distDir, { recursive: true, force: true });

  // Both bundled as CJS, Electron's best-supported format for the main
  // process and the only one its sandboxed preload loader accepts. Plain
  // `require("electron")` from a bundled CJS entry is the standard,
  // well-trodden path - an ESM main entry hit a real Node/Electron
  // interop bug importing Electron's own built-ins (tried first, reverted;
  // khameleon-decisions-log.md, 2026-10-03).
  for (const [entry, outfile] of [
    ["src/main.ts", "main.js"],
    ["src/preload.ts", "preload.js"],
  ]) {
    await esbuild({
      entryPoints: [path.resolve(here, entry)],
      platform: "node",
      bundle: true,
      format: "cjs",
      outfile: path.resolve(distDir, outfile),
      logLevel: "info",
      // Externalized as whole packages, not a "*.node" glob: these ship
      // native addons that `require()` their .node binary via a path
      // relative to their OWN file in node_modules. Bundling just the glob
      // leaves that relative require() in place but moves the calling code
      // into dist/, breaking the path (hit this for real, 2026-10-03).
      external: ["electron", "node-window-manager", "extract-file-icon"],
      sourcemap: "linked",
    });
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
