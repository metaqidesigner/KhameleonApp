import type { EngineMessage } from "./types.js";

/**
 * Turns a chat conversation into what Khami's brain needs: the earlier turns
 * as history and the newest user message as the prompt. Pure, so it can be
 * tested without loading the model.
 */
export interface KhamiTurns {
  history: ({ type: "user"; text: string } | { type: "model"; response: string[] })[];
  prompt: string;
}

export function toKhamiTurns(messages: EngineMessage[]): KhamiTurns {
  const msgs = messages.filter(m => m.content.trim().length > 0);
  let lastUser = -1;
  for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === "user") { lastUser = i; break; }
  if (lastUser === -1) return { history: [], prompt: "" };
  const history = msgs.slice(0, lastUser).map(m =>
    m.role === "user" ? { type: "user" as const, text: m.content } : { type: "model" as const, response: [m.content] },
  );
  return { history, prompt: msgs[lastUser].content };
}
