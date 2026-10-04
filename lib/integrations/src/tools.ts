import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { Runners } from "./coordinator";
import { truncateForModel } from "./localDocumentAgent.js";

/**
 * Reads real text out of a document (PDF, scanned PDF, or photo via OCR) -
 * reusing the same documentImport.ts extraction LocalDocumentAgent uses.
 * Kept as a plain injected function (not a Runners member) rather than
 * extending the shared Runners interface KhameleonCoordinator also uses:
 * this is a different shape of capability (file in, text out) than the
 * intent-routed CommandRunner pattern, and this file is the one seam that
 * actually needs it. Deliberately for NON-sensitive documents only: its
 * result flows back into Claude's cloud conversation on the next turn like
 * any other tool_result, which is exactly what LocalDocumentAgent's
 * separate, cloud-free IPC channel exists to avoid for sensitive ones
 * (Cross-App Control Phase 4, khameleon-decisions-log.md, 2026-10-04).
 */
export type DocumentTextReader = (filePath: string) => Promise<string>;

const MAX_DOCUMENT_TOOL_CHARS = 12_000;

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
      "Control desktop windows and floating widgets, and observe/control OTHER apps' windows already open on the user's desktop. Can open a YouTube video (or other URL) as an enlarged floating widget, move/dock the most recently opened widget to a screen position (enlarged, docked-right, docked-left, corner), or close it. Can also 'observe <app name>' (shows a colored border around that window while Khameleon watches it, e.g. to read its content) or 'control <app name>' (same border, signaling Khameleon is actively driving it) — both require the user's one-time Allow in a permission prompt. Once a window is 'controlling', you can actually click and type into it like a real user would: 'click at <x>,<y> in <app name>' (screen coordinates — figure out where to click from what you can see on screen) and 'type \"<text>\" into <app name>' (optionally 'at <x>,<y>' to click a field first). 'stop observing' / 'stop controlling' ends it. Pass ONE short natural-language instruction per call, e.g. 'open youtube https://youtube.com/watch?v=... as Focus Music', 'move it to the corner', 'observe Notepad', 'control Excel', 'type \"Q3 revenue\" into Excel at 400,120', 'stop observing'. Call this tool multiple times in sequence for multi-step requests.",
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
  {
    name: "read_document",
    description:
      "Reads the real text content of a local document - a PDF (including a scanned one with no text layer, via on-device OCR) or a photo (JPEG/PNG/HEIC) of a printed page or receipt. Returns the document's actual text so you can read figures, dates, names, etc. out of it. ONLY use this for documents the user hasn't flagged as sensitive/private - this tool's result is sent to Claude's cloud API like any other tool result. For a document the user wants kept fully offline (e.g. explicitly marked confidential), tell the user to use Khameleon's separate local/sensitive document mode instead of calling this tool on it.",
    input_schema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Absolute path to the PDF or photo file to read." },
      },
      required: ["filePath"],
    },
  },
];

const KNOWN_TOOLS = new Set(["window_command", "file_command", "memory_command", "read_document"]);

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
  readDocumentText?: DocumentTextReader,
): Promise<string> {
  if (!KNOWN_TOOLS.has(name)) {
    throw new Error(`Unknown tool: '${name}'. No handler registered.`);
  }

  if (name === "read_document") {
    if (!readDocumentText) throw new Error("Document reading isn't available in this context.");
    const filePath = typeof input.filePath === "string" ? input.filePath.trim() : "";
    if (!filePath) throw new Error("Tool 'read_document' requires a non-empty 'filePath' string.");

    const fullText = await readDocumentText(filePath);
    const { text, truncated } = truncateForModel(fullText, MAX_DOCUMENT_TOOL_CHARS);
    return truncated ? `${text}\n\n[...truncated - this document is longer than shown above...]` : text;
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
