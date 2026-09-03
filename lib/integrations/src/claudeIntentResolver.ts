import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { Intent, IntentResolver } from "./types";

const ROUTING_TOOL: Tool = {
  name: "route_request",
  description: "Choose the one Khameleon capability that should handle the request.",
  input_schema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: ["window", "file", "memory"] },
      command: { type: "string" },
      label: { type: "string" },
      url: { type: "string" },
      preset: { type: "string", enum: ["enlarged", "docked-right", "docked-left", "corner"] },
      value: { type: "string" },
      destination: { type: "string" },
      key: { type: "string" },
    },
    required: ["kind", "command"],
  },
};

const SYSTEM = `You route requests for Khameleon. Select exactly one capability.
window handles opening YouTube/widgets, moving the last widget, or closing it.
file handles folders, moving/trashing/sorting files, and opening/quitting apps.
memory handles remembering/recalling facts and saving/searching notes.
Return only the route_request tool input. Preserve user casing in names and paths.
For destructive file requests choose trash-file, never permanent deletion.`;

export class ClaudeIntentResolver implements IntentResolver {
  constructor(
    private client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
    private model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
  ) {}

  async resolve(text: string): Promise<Intent> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 512,
      system: SYSTEM,
      tools: [ROUTING_TOOL],
      tool_choice: { type: "tool", name: ROUTING_TOOL.name },
      messages: [{ role: "user", content: text }],
    });
    const block = response.content.find((item) => item.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("Claude did not return a routing intent.");
    return validateIntent(block.input);
  }
}

function validateIntent(value: unknown): Intent {
  if (!value || typeof value !== "object") throw new Error("Invalid routing intent.");
  const intent = value as Record<string, unknown>;
  if (!isString(intent.kind) || !isString(intent.command)) throw new Error("Routing intent is missing kind or command.");

  if (intent.kind === "window") {
    if (intent.command === "open" && isString(intent.label) && isString(intent.url)) {
      return { kind: "window", command: "open", label: intent.label, url: intent.url };
    }
    if (intent.command === "teleport" && isPreset(intent.preset)) return { kind: "window", command: "teleport", preset: intent.preset };
    if (intent.command === "close") return { kind: "window", command: "close" };
  }

  if (intent.kind === "file" && isFileCommand(intent.command) && isString(intent.value)) {
    return { kind: "file", command: intent.command, value: intent.value, ...(isString(intent.destination) ? { destination: intent.destination } : {}) };
  }

  if (intent.kind === "memory" && isMemoryCommand(intent.command)) {
    return {
      kind: "memory",
      command: intent.command,
      ...(isString(intent.key) ? { key: intent.key } : {}),
      ...(isString(intent.value) ? { value: intent.value } : {}),
    };
  }

  throw new Error(`Unsupported routing intent: ${intent.kind}/${intent.command}`);
}

function isString(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function isPreset(value: unknown): value is "enlarged" | "docked-right" | "docked-left" | "corner" {
  return value === "enlarged" || value === "docked-right" || value === "docked-left" || value === "corner";
}
function isFileCommand(value: string): value is "create-folder" | "move-file" | "trash-file" | "sort-folder" | "open-app" | "quit-app" {
  return ["create-folder", "move-file", "trash-file", "sort-folder", "open-app", "quit-app"].includes(value);
}
function isMemoryCommand(value: string): value is "remember" | "recall" | "save-note" | "search-notes" {
  return ["remember", "recall", "save-note", "search-notes"].includes(value);
}
