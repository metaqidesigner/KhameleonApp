import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { Runners } from "./coordinator";

/**
 * Real desktop-action tools for the local agent (apps/khameleon-shell).
 *
 * Unlike the api-server's agent tools (which only read/write the Khameleon
 * codebase itself), these tools reuse the already-tested `CommandRunner`
 * classes from khameleon-window-agent / khameleon-file-agent / khameleon-memory
 * to take real actions on the user's machine: moving windows, touching files,
 * launching apps, and remembering facts/notes.
 *
 * Each tool takes a single natural-language `command` string rather than a
 * fully structured schema. This is deliberate — it reuses each module's
 * existing, tested `parseCommand()` parser instead of duplicating that logic
 * in a second schema, per the "parseCommand is the seam for real agent
 * reasoning" pattern documented in each module's README. Claude decides
 * *when* and *how many times* to call a tool; the parser decides what the
 * resulting command means.
 */
export const LOCAL_TOOL_DEFINITIONS: Tool[] = [
  {
    name: "window_command",
    description:
      "Control desktop windows and floating widgets. Can open a YouTube video (or other URL) as an enlarged floating widget, move/dock the most recently opened widget to a screen position (enlarged, docked-right, docked-left, corner), or close it. Pass ONE short natural-language instruction per call, e.g. 'open youtube https://youtube.com/watch?v=... as Focus Music', 'move it to the corner', 'dock it right', or 'close it'. Call this tool multiple times in sequence for multi-step window requests (e.g. open, then move).",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Natural-language window/widget instruction." },
      },
      required: ["command"],
    },
  },
  {
    name: "file_command",
    description:
      "Manage local files and apps. Can create folders, move a file, trash a file (recoverable — never permanent), auto-sort a folder using drop-zone rules, or open/quit a macOS app. Pass ONE short natural-language instruction per call, e.g. 'create folder Invoices', 'move report.pdf to Invoices', 'trash old-draft.docx', 'sort Downloads', 'open Slack', 'quit Slack'.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Natural-language file/app instruction." },
      },
      required: ["command"],
    },
  },
  {
    name: "memory_command",
    description:
      "Remember a fact, recall a previously remembered fact, save a note, or search saved notes. Pass ONE short natural-language instruction per call, e.g. 'remember my timezone is EST', 'what is my timezone', 'note: call the dentist Friday', 'find notes about dentist'.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Natural-language memory instruction." },
      },
      required: ["command"],
    },
  },
];

const KNOWN_TOOLS = new Set(["window_command", "file_command", "memory_command"]);

/**
 * Execute a named local-agent tool against the real runners.
 * Throws if the tool name is unknown or the `command` input is missing/empty —
 * callers (LocalAgentRunner) turn a thrown error into a tool_result error
 * block rather than crashing the whole turn.
 */
export async function dispatchLocalTool(
  name: string,
  input: Record<string, unknown>,
  runners: Runners,
): Promise<string> {
  if (!KNOWN_TOOLS.has(name)) {
    throw new Error(`Unknown tool: '${name}'. No handler registered.`);
  }

  const command = typeof input.command === "string" ? input.command.trim() : "";
  if (!command) {
    throw new Error(`Tool '${name}' requires a non-empty 'command' string.`);
  }

  switch (name) {
    case "window_command":
      return runners.window.run(command);
    case "file_command":
      return runners.file.run(command);
    case "memory_command":
      return runners.memory.run(command);
    default:
      // Unreachable — guarded by KNOWN_TOOLS above.
      throw new Error(`Unknown tool: '${name}'.`);
  }
}
