import type { EngineRequest, EngineResult, EngineStatus } from "./types.js";
import { toKhamiTurns } from "./khamiHistory.js";

/**
 * Khami's engine - Khameleon's own AI, running on this computer with no
 * internet (docs/khami-design.md). The language brain is an open,
 * commercially licensed model (Qwen 2.5, Apache 2.0) run by llama.cpp
 * (MIT) through node-llama-cpp; users never see or choose it.
 *
 * Loaded lazily on first use and kept in memory. One answer at a time:
 * requests queue so a busy laptop isn't asked to think about two things
 * at once.
 */

const DEFAULT_BRAIN = "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M";
const BRAIN_URI = process.env.KHAMI_BRAIN ?? DEFAULT_BRAIN;
export const KHAMI_BRAIN_LABEL = BRAIN_URI.includes("Qwen2.5-1.5B") ? "Qwen 2.5 (1.5B)" : BRAIN_URI;

type LlamaModule = typeof import("node-llama-cpp");
let llamaModule: Promise<LlamaModule> | null = null;
const loadModule = () => (llamaModule ??= import("node-llama-cpp"));

let loaded: Promise<{ context: import("node-llama-cpp").LlamaContext; LlamaChatSession: LlamaModule["LlamaChatSession"] }> | null = null;

async function findBrainFile(): Promise<string | null> {
  const { resolveModelFile } = await loadModule();
  try {
    // Never download in the middle of a request - that's first-run setup's job.
    return await resolveModelFile(BRAIN_URI, { download: false, cli: false });
  } catch {
    return null;
  }
}

async function load() {
  const { getLlama, LlamaChatSession } = await loadModule();
  const brainPath = await findBrainFile();
  if (!brainPath) throw new Error("Khami's brain isn't downloaded on this computer yet.");
  const llama = await getLlama();
  const model = await llama.loadModel({ modelPath: brainPath });
  const context = await model.createContext({ contextSize: 4096 });
  return { context, LlamaChatSession };
}

let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export async function khamiStatus(): Promise<EngineStatus> {
  const path = await findBrainFile().catch(() => null);
  return {
    id: "khami",
    name: "Khami",
    available: !!path,
    note: path ? undefined : "Khami's brain isn't downloaded on this computer yet.",
    onThisComputer: true,
  };
}

export async function askKhami(req: EngineRequest): Promise<EngineResult> {
  return oneAtATime(async () => {
    const t0 = Date.now();
    loaded ??= load();
    let parts;
    try {
      parts = await loaded;
    } catch (err) {
      loaded = null; // let a later request retry (e.g. after the brain is downloaded)
      throw err;
    }
    const { history, prompt } = toKhamiTurns(req.messages);
    if (!prompt) throw new Error("There's no question for Khami to answer.");

    const sequence = parts.context.getSequence();
    const session = new parts.LlamaChatSession({ contextSequence: sequence, systemPrompt: req.system });
    try {
      if (history.length) session.setChatHistory([{ type: "system", text: req.system }, ...history]);
      const content = await session.prompt(prompt, {
        maxTokens: req.maxTokens ?? 1024,
        onTextChunk: req.onToken,
      });
      return {
        content,
        engine: "khami",
        model: KHAMI_BRAIN_LABEL,
        latencyMs: Date.now() - t0,
        tokens: Math.ceil(content.length / 4),
      };
    } finally {
      session.dispose();
      sequence.dispose();
    }
  });
}
