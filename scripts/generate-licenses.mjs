#!/usr/bin/env node
/**
 * Generates THIRD_PARTY_LICENSES.md (repo root) and the copy the app serves
 * (artifacts/khameleon-command/public/third-party-licenses.txt), from what
 * Khameleon actually ships:
 *   - every production package of the server, desktop app and libraries
 *     (`pnpm licenses list --prod -r`),
 *   - every package bundled into the built frontend (read from a source-mapped
 *     build), and
 *   - the non-package items below (AI models, fonts, Chromium, OCR data, adapted skills).
 * Each entry includes its licence text and any NOTICE file (Apache 2.0 requires it).
 *
 * Fails if any licence isn't on the commercial-use allow-list, so a problem
 * can't slip in unnoticed (docs/legal-compliance.md, rule 3).
 *
 *   node scripts/generate-licenses.mjs           # write the files
 *   node scripts/generate-licenses.mjs --check   # only check the allow-list
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checkOnly = process.argv.includes("--check");

/** Licences allowed for commercial distribution (SPDX ids). */
const ALLOWED = new Set(["MIT", "MIT-0", "ISC", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "BSD", "0BSD", "BlueOak-1.0.0", "Unlicense", "Zlib", "CC0-1.0", "OFL-1.1", "Python-2.0", "WTFPL", "CC-BY-4.0"]);
const OWN = /^(@workspace\/|@khameleon\/|khameleon-)/;

/** "(MIT OR GPL-3.0-or-later)" passes if one choice is allowed; "MIT AND Zlib" needs all. */
export function licenceAllowed(expr) {
  const e = String(expr || "").replace(/[()]/g, "").trim();
  if (!e) return false;
  if (/\bOR\b/.test(e)) return e.split(/\s+OR\s+/).some(licenceAllowed);
  if (/\bAND\b/.test(e)) return e.split(/\s+AND\s+/).every(licenceAllowed);
  return ALLOWED.has(e);
}

function pnpmLicences(cwd, args) {
  const out = execFileSync("pnpm", ["licenses", "list", "--json", ...args], { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  const byLicence = JSON.parse(out);
  const list = [];
  for (const [licence, pkgs] of Object.entries(byLicence)) for (const p of pkgs) list.push({ ...p, license: licence });
  return list;
}

/** Packages inside the built frontend, from a source-mapped build. */
function frontendPackages() {
  const app = path.join(root, "artifacts/khameleon-command");
  const out = mkdtempSync(path.join(tmpdir(), "khameleon-fe-"));
  try {
    execFileSync("npx", ["vite", "build", "--sourcemap", "--outDir", out, "--emptyOutDir", "--logLevel", "error"], { cwd: app, env: { ...process.env, PORT: "5199", BASE_PATH: "/" }, stdio: "ignore" });
    const names = new Set();
    const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith(".map")) for (const s of JSON.parse(readFileSync(p, "utf8")).sources ?? []) { const m = s.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/); if (m) names.add(m[1]); } } };
    walk(out);
    const all = pnpmLicences(app, []);
    return all.filter(p => names.has(p.name));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

function licenceText(dir) {
  if (!dir || !existsSync(dir)) return "";
  const files = readdirSync(dir).filter(f => /^(licen[cs]e|copying|notice)(\.|-|$)/i.test(f)).sort();
  return files.map(f => readFileSync(path.join(dir, f), "utf8").trim()).join("\n\n");
}

/** Shipped items that aren't npm packages. */
const EXTRAS = [
  { name: "Qwen2.5-1.5B-Instruct and Qwen2.5-7B-Instruct (GGUF)", version: "2.5", license: "Apache-2.0", use: "Khami's built-in language brain (downloaded at setup from huggingface.co/Qwen)", copyright: "Copyright 2024 Alibaba Cloud", text: "Licensed under the Apache License, Version 2.0 (see the Apache 2.0 text under any Apache-2.0 package below). Model cards: https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF and https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF. Khameleon does not use the Qwen name or branding in the product." },
  { name: "llama.cpp (ggml)", version: "bundled with node-llama-cpp", license: "MIT", use: "Runs Khami on the user's computer", copyright: "Copyright (c) 2023-2026 The ggml authors", text: "MIT licence - standard text under \"Standard licence texts\" at the end, with copyright (c) 2023-2026 The ggml authors." },
  { name: "Tesseract English language data (eng.traineddata)", version: "4.x", license: "Apache-2.0", use: "On-device OCR of scanned documents (downloaded once on first use)", copyright: "Copyright Google Inc. and Tesseract contributors", text: "Licensed under the Apache License, Version 2.0. Source: https://github.com/tesseract-ocr/tessdata_fast" },
  { name: "Electron and Chromium", version: "see package list", license: "MIT", use: "Desktop app", copyright: "Copyright (c) Electron contributors; Chromium: The Chromium Authors and others", text: "Electron is MIT-licensed (text under the electron package below). Chromium and its components carry their own notices, shipped inside the installed app as LICENSES.chromium.html next to the Electron licence." },
  { name: "JetBrains Mono, Space Grotesk, Inter, Plus Jakarta Sans (fonts)", version: "variable", license: "OFL-1.1", use: "Typefaces in the app (shipped with it - nothing is loaded from Google Fonts)", copyright: "JetBrains s.r.o.; Florian Karsten; The Inter Project Authors; The Plus Jakarta Sans Project Authors", text: "SIL Open Font License, Version 1.1 - https://openfontlicense.org. The fonts may be used, bundled and distributed freely with software; they may not be sold on their own." },
  { name: "Anthropic \"internal-comms\" and \"skill-creator\" skills", version: "2025", license: "Apache-2.0", use: "Adapted into Khameleon's \"Internal communications\" and \"Skill writer\" skills", copyright: "Copyright 2025 Anthropic, PBC", text: "Licensed under the Apache License, Version 2.0. MODIFIED: rewritten and adapted for Khameleon (Skill writer: instructions only)." },
];

const MIT_TEXT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

/** The full text of a standard licence, taken from a shipped package that includes it. */
function standardText(licence, pkgs) {
  if (licence === "MIT") return `MIT License\n\nCopyright (c) <year> <copyright holder>\n\n${MIT_TEXT}`;
  for (const p of pkgs) {
    if (p.license !== licence) continue;
    const t = licenceText(p.path);
    if (licence === "Apache-2.0" && /TERMS AND CONDITIONS FOR USE, REPRODUCTION/.test(t)) return t.slice(t.indexOf("Apache License"));
    if (licence === "Unlicense" && /public domain/i.test(t)) return t;
  }
  return licence === "Apache-2.0" ? "See https://www.apache.org/licenses/LICENSE-2.0.txt" : "See https://unlicense.org";
}

function main() {
  const server = pnpmLicences(root, ["--prod", "-r"]);
  const front = frontendPackages();
  const byName = new Map();
  for (const p of [...server, ...front]) {
    if (OWN.test(p.name)) continue;
    const prev = byName.get(p.name);
    byName.set(p.name, { name: p.name, versions: [...new Set([...(prev?.versions ?? []), ...(p.versions ?? [])])], license: p.license, author: p.author ?? "", homepage: p.homepage ?? "", path: (p.paths ?? [])[0] ?? prev?.path });
  }
  const pkgs = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  const bad = [...pkgs, ...EXTRAS].filter(p => !licenceAllowed(p.license));
  if (bad.length) {
    console.error("Licences not on the commercial-use allow-list:\n" + bad.map(p => `  ${p.name}: ${p.license}`).join("\n"));
    process.exit(1);
  }
  console.log(`${pkgs.length} packages + ${EXTRAS.length} other items - all on the allow-list.`);
  if (checkOnly) return;

  const counts = {};
  for (const p of pkgs) counts[p.license] = (counts[p.license] ?? 0) + 1;
  const lines = [
    "# Third-party licences",
    "",
    "Khameleon uses the open-source software, models, fonts and materials below. Generated by `node scripts/generate-licenses.mjs` from what the app actually ships; do not edit by hand. The same list is served inside the app (About Khameleon → Licences → \"All third-party licences\").",
    "",
    `**${pkgs.length} software packages** (${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${n} ${l}`).join(", ")}) **and ${EXTRAS.length} other items.** Every licence allows commercial use; the generator refuses any that doesn't.`,
    "",
    "Not used, by decision: Anthropic's Word/PDF/PowerPoint/Excel skills (restricted licence), Anthropic's doc-coauthoring skill (no licence), Llama models (licence conditions), Qwen2.5-3B/72B (non-Apache licences), Ollama (not needed).",
    "",
    "## Models, fonts and other items",
    "",
    ...EXTRAS.flatMap(e => {
      const text = e.text;
      return [`### ${e.name}`, "", `${e.use}. Licence: **${e.license}**. ${e.copyright}.`, "", text ? "```\n" + text + "\n```" : "", ""];
    }),
    "## Software packages",
    "",
    ...pkgs.flatMap(p => {
      const text = licenceText(p.path);
      const who = p.author ? (typeof p.author === "string" ? p.author : p.author.name ?? "") : "";
      return [`### ${p.name} ${p.versions.join(", ")}`, "", `Licence: **${p.license}**${who ? ` · ${who}` : ""}${p.homepage ? ` · ${p.homepage}` : ""}`, "", text ? "```\n" + text + "\n```" : `The package has no licence file; it is ${p.license}-licensed - standard text under "Standard licence texts" below${who ? `, copyright ${who}` : ""}.`, ""];
    }),
    "## Standard licence texts",
    "",
    "For entries above that refer here (the copyright holder is named in each entry).",
    "",
    ...["MIT", "Apache-2.0", "Unlicense"].flatMap(l => [`### ${l}`, "", "```\n" + standardText(l, pkgs) + "\n```", ""]),
  ];
  const md = lines.join("\n");
  writeFileSync(path.join(root, "THIRD_PARTY_LICENSES.md"), md);
  writeFileSync(path.join(root, "artifacts/khameleon-command/public/third-party-licenses.txt"), md);
  console.log("Wrote THIRD_PARTY_LICENSES.md and artifacts/khameleon-command/public/third-party-licenses.txt");
}

main();
