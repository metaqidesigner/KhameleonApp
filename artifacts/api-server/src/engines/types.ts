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

/** A tool the AI may call; Khameleon runs it (agents/tools/anyAiTools.ts). */
export interface EngineTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (input: Record<string, unknown>) => Promise<string>;
}

export type EngineToolEvent =
  | { type: "tool_start"; name: string; input?: Record<string, unknown> }
  | { type: "tool_result"; name: string; result?: string; durationMs?: number }
  | { type: "tool_error"; name: string; error?: string; durationMs?: number };

export interface EngineRequest {
  system: string;
  messages: EngineMessage[];
  maxTokens?: number;
  onToken?: (text: string) => void;
  tools?: EngineTool[];
  onToolEvent?: (e: EngineToolEvent) => void;
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
