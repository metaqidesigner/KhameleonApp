import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { rm, mkdir, copyFile, cp, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createRequire as makeRequire } from "node:module";
import { execFileSync } from "node:child_process";

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
      external: [
        "electron",
        "node-window-manager",
        "extract-file-icon",
        "node-llama-cpp",
        "pdf-parse",
        "@napi-rs/canvas",
        "tesseract.js",
      ],
      sourcemap: "linked",
    });
  }

  // Licence notices that must ship inside the installed app (docs/legal-compliance.md):
  // Electron's own licence and Chromium's bundled notices.
  const electronDir = path.dirname(makeRequire(import.meta.url).resolve("electron/package.json"));
  const notices = path.resolve(here, "build-resources/notices");
  await mkdir(notices, { recursive: true });
  await copyFile(path.join(electronDir, "dist/LICENSES.chromium.html"), path.join(notices, "LICENSES.chromium.html"));
  await copyFile(path.join(electronDir, "dist/LICENSE"), path.join(notices, "LICENSE.electron.txt"));

  // The all-in-one app (src/localServer.ts): Khameleon's server, its screens and
  // the built-in database's table set-up travel inside the desktop app.
  // Built first by `pnpm bundle` (the server's own build + the screens' build).
  const repo = path.resolve(here, "../..");
  const serverDist = path.join(repo, "artifacts/api-server/dist");
  const webDist = path.join(repo, "artifacts/khameleon-command/dist/public");
  if (existsSync(path.join(serverDist, "index.mjs")) && existsSync(path.join(webDist, "index.html"))) {
    await mkdir(path.join(distDir, "server"), { recursive: true });
    for (const f of await readdir(serverDist)) {
      if (f.endsWith(".mjs")) await copyFile(path.join(serverDist, f), path.join(distDir, "server", f));
    }
    await cp(webDist, path.join(distDir, "web"), { recursive: true });
    await cp(path.join(repo, "lib/db/migrations"), path.join(distDir, "migrations"), { recursive: true });
  } else {
    console.warn("Server or screens not built - run `pnpm bundle` first. This build can only use another server (KHAMELEON_APP_URL).");
  }

  // Capture full recording (native/mac/KhameleonInput.swift): Khameleon's own
  // helper for watching clicks/typing and replaying them by element name.
  // Built here on a Mac; elsewhere Capture records windows only.
  if (process.platform === "darwin") {
    await mkdir(path.resolve(distDir, "native"), { recursive: true });
    try {
      execFileSync("swiftc", ["-O", "-swift-version", "5", path.resolve(here, "native/mac/KhameleonInput.swift"), "-o", path.resolve(distDir, "native/khameleon-input")], { stdio: "inherit" });
    } catch {
      console.warn("Couldn't build the input helper (swiftc missing?) - Capture will record windows only.");
    }
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
