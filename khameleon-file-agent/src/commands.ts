import { AppLauncher } from "./types";
import { FileOps } from "./fileOps";
import { planSort } from "./dropZones";

export type Command =
  | { type: "create-folder"; name: string }
  | { type: "move-file"; from: string; to: string }
  | { type: "trash-file"; name: string }
  | { type: "sort-folder"; folder: string }
  | { type: "open-app"; appName: string }
  | { type: "quit-app"; appName: string };

/**
 * Same philosophy as khameleon-window-agent/src/commands.ts: an explicit,
 * testable, non-LLM parser for v1 so the execution layer below it can be
 * built and verified independently of the agent brain.
 *
 * Deliberately does NOT expose permanent delete — "delete X" maps to
 * trash-file (recoverable). Permanent deletion is not reachable from a
 * parsed text/voice command at all in this layer.
 */
export function parseCommand(text: string): Command | null {
  const t = text.trim();

  // Matched case-insensitively via the `i` flag, but against the original-case
  // string `t` — so the captured folder/file names keep whatever casing the
  // user actually typed instead of being silently lowercased.
  let m = t.match(/^(?:create|make)\s+(?:a\s+)?folder\s+(?:called\s+|named\s+)?["']?([^"']+)["']?$/i);
  if (m) return { type: "create-folder", name: m[1].trim() };

  m = t.match(/^move\s+(.+?)\s+to\s+(.+)$/i);
  if (m) return { type: "move-file", from: m[1].trim(), to: m[2].trim() };

  m = t.match(/^(?:delete|trash|remove)\s+(.+)$/i);
  if (m) return { type: "trash-file", name: m[1].trim() };

  m = t.match(/^sort\s+(?:my\s+)?(.+)$/i);
  if (m) return { type: "sort-folder", folder: m[1].trim() };

  m = t.match(/^(?:open|launch|start)\s+(.+)$/i);
  if (m) return { type: "open-app", appName: m[1].trim() };

  m = t.match(/^(?:quit|close|stop)\s+(.+)$/i);
  if (m) return { type: "quit-app", appName: m[1].trim() };

  return null;
}

export class CommandRunner {
  constructor(private fileOps: FileOps, private launcher: AppLauncher) {}

  async run(text: string): Promise<string> {
    const cmd = parseCommand(text);
    if (!cmd) return `Didn't understand: "${text}"`;

    switch (cmd.type) {
      case "create-folder":
        await this.fileOps.createFolder(cmd.name);
        return `Created folder "${cmd.name}".`;

      case "move-file":
        await this.fileOps.moveFile(cmd.from, cmd.to);
        return `Moved "${cmd.from}" to "${cmd.to}".`;

      case "trash-file":
        await this.fileOps.moveToTrash(cmd.name);
        return `Moved "${cmd.name}" to trash (recoverable).`;

      case "sort-folder": {
        const files = await this.fileOps.listDirectory(cmd.folder);
        const plan = planSort(files);
        let moved = 0;
        for (const entry of plan) {
          if (!entry.rule || !entry.destinationPath) continue;
          const relFrom = `${cmd.folder}/${entry.file.name}`;
          const relTo = `${cmd.folder}/${entry.destinationPath}`;
          await this.fileOps.moveFile(relFrom, relTo);
          moved++;
        }
        return `Sorted ${moved} of ${plan.length} file(s) in "${cmd.folder}".`;
      }

      case "open-app":
        await this.launcher.open(cmd.appName);
        return `Opened ${cmd.appName}.`;

      case "quit-app":
        await this.launcher.quit(cmd.appName);
        return `Quit ${cmd.appName}.`;
    }
  }
}
