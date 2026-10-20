import os from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { EngineRequest, EngineResult, EngineStatus } from "./types.js";
import { toKhamiTurns, dateContext } from "./khamiHistory.js";
import { BRAINS, recommendBrain, pickActiveBrain, type BrainId } from "./khamiBrains.js";
import { toKhamiParams, stripNulls } from "../lib/toolSchema.js";

const MAX_TOOL_RESULT = 4000;

/**
 * Khami's engine - Khameleon's own AI, running on this computer with no
 * internet (docs/khami-design.md). The language brain is an open,
 * commercially licensed model (Qwen 2.5 Instruct, Apache 2.0) run by
 * llama.cpp (MIT) through node-llama-cpp; users only ever see "Khami".
 *
 * The brain is chosen and downloaded during first-run setup (Standard or
 * Better, khamiBrains.ts) - never in the middle of a request. Loaded lazily
 * on first use and kept in memory; one answer at a time.
 */

type LlamaModule = typeof import("node-llama-cpp");
let llamaModule: Promise<LlamaModule> | null = null;
const loadModule = () => (llamaModule ??= import("node-llama-cpp"));

// ── Saved choice ─────────────────────────────────────────────────────────────

// KHAMELEON_HOME: the all-in-one app keeps everything in its own folder.
const SETTINGS_DIR = process.env.KHAMELEON_HOME ?? path.join(os.homedir(), ".khameleon");
// Brain files: inside that folder for the all-in-one app; node-llama-cpp's usual place otherwise.
const MODELS_DIR = process.env.KHAMELEON_HOME ? path.join(process.env.KHAMELEON_HOME, "models") : undefined;
const SETTINGS_FILE = path.join(SETTINGS_DIR, "khami.json");

async function readSavedBrain(): Promise<BrainId | null> {
  try {
    const v = JSON.parse(await readFile(SETTINGS_FILE, "utf8")) as { brain?: string };
    return v.brain === "standard" || v.brain === "better" ? v.brain : null;
  } catch {
    return null;
  }
}

async function saveBrain(brain: BrainId): Promise<void> {
  await mkdir(SETTINGS_DIR, { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify({ brain }, null, 2));
}

// ── What's on this computer ──────────────────────────────────────────────────

async function brainFile(id: BrainId): Promise<string | null> {
  const { resolveModelFile } = await loadModule();
  try {
    return await resolveModelFile(BRAINS[id].uri, { download: false, cli: false, directory: MODELS_DIR });
  } catch {
    return null;
  }
}

async function downloadedBrains(): Promise<Set<BrainId>> {
  const ids = Object.keys(BRAINS) as BrainId[];
  const found = await Promise.all(ids.map(async id => ((await brainFile(id)) ? id : null)));
  return new Set(found.filter((x): x is BrainId => x !== null));
}

/** The brain Khami uses now - KHAMI_BRAIN can force one (testing / company servers). */
async function activeBrain(): Promise<BrainId | null> {
  const forced = process.env.KHAMI_BRAIN;
  if (forced === "standard" || forced === "better") return forced;
  return pickActiveBrain(await readSavedBrain(), await downloadedBrains());
}

// ── Download (first-run setup) ───────────────────────────────────────────────

export interface KhamiDownload {
  state: "idle" | "downloading" | "done" | "error";
  brain?: BrainId;
  percent?: number;
  downloadedGb?: number;
  totalGb?: number;
  error?: string;
}

let download: KhamiDownload = { state: "idle" };

export function startBrainDownload(brain: BrainId): KhamiDownload {
  if (download.state === "downloading") return download;
  download = { state: "downloading", brain, percent: 0 };
  void (async () => {
    try {
      const { resolveModelFile } = await loadModule();
      await resolveModelFile(BRAINS[brain].uri, {
        cli: false,
        directory: MODELS_DIR,
        onProgress: ({ totalSize, downloadedSize }) => {
          download = {
            state: "downloading", brain,
            percent: totalSize ? Math.round((downloadedSize / totalSize) * 100) : 0,
            downloadedGb: +(downloadedSize / 1e9).toFixed(2),
            totalGb: +(totalSize / 1e9).toFixed(2),
          };
        },
      });
      await saveBrain(brain);
      unloadBrain(); // pick up the new brain on the next answer
      download = { state: "done", brain, percent: 100 };
      warmUpKhami(); // ready for the first question
    } catch (err) {
      download = { state: "error", brain, error: err instanceof Error ? err.message : String(err) };
    }
  })();
  return download;
}

export async function chooseBrain(brain: BrainId): Promise<void> {
  if (!(await brainFile(brain))) throw new Error(`The ${BRAINS[brain].label} brain isn't downloaded yet.`);
  await saveBrain(brain);
  unloadBrain();
}

/** Everything the setup screen needs. */
export async function khamiSetupInfo() {
  const memoryGb = Math.round(os.totalmem() / 1e9);
  const have = await downloadedBrains();
  const active = await activeBrain();
  return {
    memoryGb,
    recommended: recommendBrain(memoryGb),
    active,
    brains: Object.values(BRAINS).map(b => ({
      id: b.id, label: b.label, description: b.description, sizeGb: b.sizeGb,
      minMemoryGb: b.minMemoryGb, modelName: b.modelName,
      downloaded: have.has(b.id),
      fitsThisComputer: memoryGb >= b.minMemoryGb,
    })),
    download,
  };
}

// ── Answering ────────────────────────────────────────────────────────────────

type Loaded = {
  brain: BrainId;
  model: import("node-llama-cpp").LlamaModel;
  context: import("node-llama-cpp").LlamaContext;
  LlamaChatSession: LlamaModule["LlamaChatSession"];
};
let loaded: Promise<Loaded> | null = null;

/** Forget the loaded brain (after switching or downloading), freeing its memory. */
function unloadBrain(): void {
  const previous = loaded;
  loaded = null;
  previous?.then(p => { void p.context.dispose(); void p.model.dispose(); }).catch(() => undefined);
}

async function load(): Promise<Loaded> {
  const { getLlama, LlamaChatSession } = await loadModule();
  const brain = await activeBrain();
  const file = brain ? await brainFile(brain) : null;
  if (!brain || !file) throw new Error("Khami isn't set up on this computer yet - choose and download a brain in Khami setup.");
  const llama = await getLlama();
  const model = await llama.loadModel({ modelPath: file });
  const context = await model.createContext({ contextSize: 4096 });
  return { brain, model, context, LlamaChatSession };
}

/**
 * Loads Khami's brain in the background (at start-up and after a download), so
 * the first question doesn't wait for it - loading takes tens of seconds, an
 * answer a couple. Does nothing if Khami isn't set up.
 */
export function warmUpKhami(): void {
  void activeBrain().then(brain => {
    if (!brain || loaded) return;
    loaded = load();
    loaded.catch(() => { loaded = null; });
  }).catch(() => undefined);
}

let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export async function khamiStatus(): Promise<EngineStatus> {
  const brain = await activeBrain().catch(() => null);
  return {
    id: "khami",
    name: "Khami",
    available: !!brain,
    note: brain ? undefined : "Khami isn't set up on this computer yet.",
    onThisComputer: true,
  };
}

/** Label for the licence small print, e.g. "Qwen 2.5 (1.5B)". */
export async function khamiBrainLabel(): Promise<string> {
  const brain = await activeBrain().catch(() => null);
  return brain ? BRAINS[brain].modelName : "not set up";
}

/** Integrations and tools Khami may call - Khameleon runs them and hands back the result. */
async function khamiFunctions(req: EngineRequest) {
  const { defineChatSessionFunction } = await loadModule();
  const fns: Record<string, ReturnType<typeof defineChatSessionFunction>> = {};
  for (const tool of req.tools ?? []) {
    fns[tool.name] = defineChatSessionFunction({
      description: tool.description,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      params: toKhamiParams(tool.parameters) as any,
      handler: async (input: unknown) => {
        const args = stripNulls((input && typeof input === "object" ? input : {}) as Record<string, unknown>);
        req.onToolEvent?.({ type: "tool_start", name: tool.name, input: args });
        const t0 = Date.now();
        try {
          const result = (await tool.run(args)).slice(0, MAX_TOOL_RESULT);
          req.onToolEvent?.({ type: "tool_result", name: tool.name, result: result.slice(0, 300), durationMs: Date.now() - t0 });
          return result;
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          req.onToolEvent?.({ type: "tool_error", name: tool.name, error, durationMs: Date.now() - t0 });
          return `That didn't work: ${error}`;
        }
      },
    });
  }
  return fns;
}

export async function askKhami(req: EngineRequest): Promise<EngineResult> {
  return oneAtATime(async () => {
    const t0 = Date.now();
    loaded ??= load();
    let parts;
    try {
      parts = await loaded;
    } catch (err) {
      loaded = null; // retry on the next request (e.g. after setup)
      throw err;
    }
    const { history, prompt } = toKhamiTurns(req.messages);
    if (!prompt) throw new Error("There's no question for Khami to answer.");
    req = { ...req, system: `${req.system}\n\n${dateContext()}` };

    const sequence = parts.context.getSequence();
    const session = new parts.LlamaChatSession({ contextSequence: sequence, systemPrompt: req.system });
    try {
      if (history.length) session.setChatHistory([{ type: "system", text: req.system }, ...history]);
      const functions = req.tools?.length ? await khamiFunctions(req) : undefined;
      const content = await session.prompt(prompt, {
        maxTokens: req.maxTokens ?? 1024,
        onTextChunk: req.onToken,
        ...(functions ? { functions, maxParallelFunctionCalls: 1 } : {}),
      });
      return {
        content,
        engine: "khami",
        model: BRAINS[parts.brain].modelName,
        latencyMs: Date.now() - t0,
        tokens: Math.ceil(content.length / 4),
      };
    } finally {
      session.dispose();
      sequence.dispose();
    }
  });
}
