/**
 * The engine layer (docs/khami-design.md): one place every feature asks
 * "the AI" for an answer. Khami (Khameleon's own, on this computer) is the
 * default; cloud engines are optional extras.
 */
export type EngineId = "khami" | "anthropic" | "openai" | "google";

export interface EngineMessage {
  role: "user" | "assistant";
  content: string;
}

export interface EngineRequest {
  system: string;
  messages: EngineMessage[];
  maxTokens?: number;
  onToken?: (text: string) => void;
}

export interface EngineResult {
  content: string;
  engine: EngineId;
  model: string;
  latencyMs: number;
  tokens: number;
}

export interface EngineStatus {
  id: EngineId;
  name: string;
  available: boolean;
  /** Plain-language reason when not available, e.g. "Khami's brain isn't downloaded yet". */
  note?: string;
  onThisComputer: boolean;
}
