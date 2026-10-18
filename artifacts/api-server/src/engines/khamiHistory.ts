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

/**
 * Today's date and the coming week, worked out by code and handed to Khami
 * with every request - the brain doesn't know the date, and small brains
 * get "next Friday" wrong. Pure (pass `now` for testing).
 */
export function dateContext(now = new Date()): string {
  const day = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i + 1);
    return `${d.toLocaleDateString("en-GB", { weekday: "long" })} ${iso(d)}`;
  });
  return `Today is ${day(now)} (${iso(now)}). The next seven days: ${week.join(", ")}. Use these dates for "tomorrow", "Friday", "next week" and so on.`;
}
