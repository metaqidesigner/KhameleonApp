import { MemoryStore } from "./memoryStore";

export type Command =
  | { type: "remember"; key: string; value: string }
  | { type: "recall"; key: string }
  | { type: "save-note"; text: string }
  | { type: "search-notes"; query: string };

/** Same explicit, testable, non-LLM parser pattern as the other Khameleon modules. */
export function parseCommand(text: string): Command | null {
  const t = text.trim();

  // The optional "my " is stripped the same way the recall pattern below
  // strips it, so "remember my timezone is EST" and "what's my timezone"
  // resolve to the same key ("timezone") instead of silently diverging.
  let m = t.match(/^remember (?:that\s+)?(?:my\s+)?(.+?)\s+is\s+(.+)$/i);
  if (m) return { type: "remember", key: m[1].trim(), value: m[2].trim() };

  m = t.match(/^what(?:'s| is)\s+my\s+(.+?)\??$/i);
  if (m) return { type: "recall", key: m[1].trim() };

  m = t.match(/^note:?\s+(.+)$/i);
  if (m) return { type: "save-note", text: m[1].trim() };

  m = t.match(/^(?:find|search)\s+(?:my\s+)?notes?\s+(?:about|for)\s+(.+)$/i);
  if (m) return { type: "search-notes", query: m[1].trim() };

  return null;
}

export class CommandRunner {
  constructor(private memory: MemoryStore) {}

  async run(text: string): Promise<string> {
    const cmd = parseCommand(text);
    if (!cmd) return `Didn't understand: "${text}"`;

    switch (cmd.type) {
      case "remember":
        await this.memory.remember(cmd.key, cmd.value);
        return `Got it — ${cmd.key} is ${cmd.value}.`;

      case "recall": {
        const fact = await this.memory.recall(cmd.key);
        return fact ? `Your ${cmd.key} is ${fact.value}.` : `I don't know your ${cmd.key} yet.`;
      }

      case "save-note":
        await this.memory.saveNote(cmd.text);
        return "Noted.";

      case "search-notes": {
        const results = await this.memory.searchNotes(cmd.query);
        if (results.length === 0) return `No notes found about "${cmd.query}".`;
        return results.map((r) => `- ${r.item.text}`).join("\n");
      }
    }
  }
}
