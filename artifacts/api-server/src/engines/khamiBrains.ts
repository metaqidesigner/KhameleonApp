/**
 * Khami's brain choices (docs/khami-design.md). Both are Qwen 2.5 Instruct,
 * Apache 2.0 (commercial use allowed; notice shipped). Pure data + choice
 * logic so it can be tested without downloading anything.
 */
export type BrainId = "standard" | "better";

export interface BrainOption {
  id: BrainId;
  label: string;
  description: string;
  uri: string;
  /** Approximate download size, for the user. */
  sizeGb: number;
  /** Memory the computer should have for this brain to run comfortably. */
  minMemoryGb: number;
  /** Shown in the licence notices only. */
  modelName: string;
}

export const BRAINS: Record<BrainId, BrainOption> = {
  standard: {
    id: "standard",
    label: "Standard",
    description: "Quick and light. Good for short answers and simple tasks. Works on most computers.",
    uri: "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M",
    sizeGb: 1.1,
    minMemoryGb: 8,
    modelName: "Qwen 2.5 (1.5B)",
  },
  better: {
    id: "better",
    label: "Better",
    description: "Noticeably smarter, especially at writing and multi-step work. Needs a computer with 16 GB of memory.",
    uri: "hf:Qwen/Qwen2.5-7B-Instruct-GGUF:Q4_K_M",
    sizeGb: 4.7,
    minMemoryGb: 16,
    modelName: "Qwen 2.5 (7B)",
  },
};

/** Which brain to suggest for a computer with this much memory. */
export function recommendBrain(memoryGb: number): BrainId {
  return memoryGb >= BRAINS.better.minMemoryGb ? "better" : "standard";
}

/**
 * Which brain Khami should use: the saved choice if it's downloaded,
 * otherwise the best one that is downloaded, otherwise none.
 */
export function pickActiveBrain(saved: BrainId | null, downloaded: Set<BrainId>): BrainId | null {
  if (saved && downloaded.has(saved)) return saved;
  if (downloaded.has("better")) return "better";
  if (downloaded.has("standard")) return "standard";
  return null;
}
