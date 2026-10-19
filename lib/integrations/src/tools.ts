import type { CommandRunner as FileCommandRunner } from "khameleon-file-agent";
import type { CommandRunner as MemoryCommandRunner } from "khameleon-memory";
import type { CommandRunner as WindowCommandRunner } from "khameleon-window-agent";
import { truncateForModel } from "./localDocumentAgent.js";

/**
 * Reads real text out of a document (PDF, scanned PDF, or photo via OCR) -
 * reusing the same documentImport.ts extraction LocalDocumentAgent uses.
 * Kept as a plain injected function (file in, text out) rather than a
 * Runners member.
 */
/** The tested window/file/memory command runners the desktop app owns. */
export interface Runners {
  window: WindowCommandRunner;
  file: FileCommandRunner;
  memory: MemoryCommandRunner;
}

export type DocumentTextReader = (filePath: string) => Promise<string>;

const MAX_DOCUMENT_TOOL_CHARS = 12_000;

const KNOWN_TOOLS = new Set(["window_command", "file_command", "memory_command", "read_document"]);

/**
 * Runs one of the desktop app's local tools (asked for by the server over
 * the desktop link) against the real runners.
 * Throws if the tool name is unknown or the `command` input is missing/empty —
 * the desktop link reports a thrown error back as a failed result.
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
