/**
 * One way for Khameleon's own features to ask "the AI" (docs/khami-design.md,
 * step 4). Khami - on this computer - answers by default; when Khami isn't
 * set up, the first outside AI the user has (Microsoft 365 Copilot first,
 * then Claude, GPT, Gemini) answers instead. Replaces the features that
 * used to call Claude directly.
 *
 * `plain` jobs (summaries, sorting, drafting) get no skills or tools - just
 * the answer. `withTools` jobs (task runs) get the same safe tools as chat.
 */
import { askAgent, isAgentAvailable } from "../agents/gateway.js";
import { findAgent } from "../agents/defaults.js";
import type { AgentConfig, ToolEvent } from "../agents/types.js";

export const AI_ORDER = ["khami", "copilot", "claude", "gpt4o", "gemini"] as const;

export async function firstAvailableAI(): Promise<AgentConfig | undefined> {
  for (const id of AI_ORDER) {
    const a = findAgent(id);
    if (a && (await isAgentAvailable(a))) return a;
  }
  return undefined;
}

/** "Khami", "Copilot", or the outside AI's name - for "Written by …" notes. */
export function aiLabel(agent: Pick<AgentConfig, "id" | "name">): string {
  if (agent.id === "khami") return "Khami";
  if (agent.id === "copilot") return "Copilot";
  if (agent.id === "claude") return "Claude";
  if (agent.id === "gpt4o") return "GPT";
  if (agent.id === "gemini") return "Gemini";
  return agent.name;
}

export class NoAIError extends Error {
  status = 503;
  constructor() { super("No AI is available - set up Khami (head menu > Khami setup)."); }
}

export interface AskAIOptions {
  system?: string;
  prompt: string;
  withTools?: boolean;
  onToolEvent?: (e: ToolEvent) => void;
  /** Use this AI instead of the usual order (e.g. "copilot" when the user picked Ask Copilot). */
  agentId?: string;
}

export async function askAI(opts: AskAIOptions): Promise<{ text: string; by: string; agentId: string }> {
  let agent: AgentConfig | undefined;
  if (opts.agentId) {
    const a = findAgent(opts.agentId);
    agent = a && (await isAgentAvailable(a)) ? a : undefined;
  } else {
    agent = await firstAvailableAI();
  }
  if (!agent) throw new NoAIError();
  const messages = [
    ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
    { role: "user" as const, content: opts.prompt },
  ];
  const r = await askAgent(agent, messages, undefined, opts.onToolEvent, { plain: !opts.withTools });
  if (r.error) throw new Error(r.error);
  return { text: r.content, by: aiLabel(agent), agentId: agent.id };
}
