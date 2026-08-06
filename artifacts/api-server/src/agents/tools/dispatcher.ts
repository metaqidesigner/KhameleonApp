/**
 * Tool dispatcher — the security boundary between Claude's tool calls and the shell.
 * Every tool Claude requests passes through here before any execution.
 */

import {
  readFile, writeFile, listFiles, runBuild, runCommand,
  gitStatus, gitLog, checkWorkflow, readLogs,
} from "./shell.js";

export type ToolInput = Record<string, unknown>;

/**
 * Execute a named tool with the given input.
 * Throws if the tool name is unknown or input fails validation.
 * Returns a string result to send back to Claude as a tool_result.
 */
export async function dispatchTool(name: string, input: ToolInput): Promise<string> {
  switch (name) {
    case "read_file": {
      const p = requireString(input, "path");
      return readFile(p);
    }

    case "write_file": {
      const p       = requireString(input, "path");
      const content = requireString(input, "content");
      return writeFile(p, content);
    }

    case "list_files": {
      const dir     = requireString(input, "dir");
      const pattern = optionalString(input, "pattern");
      return listFiles(dir, pattern);
    }

    case "run_build": {
      const pkg = requireString(input, "package");
      return runBuild(pkg);
    }

    case "run_command": {
      const cmd = requireString(input, "command");
      return runCommand(cmd);
    }

    case "git_status": {
      return gitStatus();
    }

    case "git_log": {
      const limit = optionalNumber(input, "limit") ?? 10;
      return gitLog(limit);
    }

    case "check_workflow": {
      return checkWorkflow();
    }

    case "read_logs": {
      const lines  = optionalNumber(input, "lines") ?? 100;
      const filter = optionalString(input, "filter");
      return readLogs(lines, filter);
    }

    default:
      throw new Error(`Unknown tool: '${name}'. No handler registered.`);
  }
}

// ── Input helpers ─────────────────────────────────────────────

function requireString(input: ToolInput, key: string): string {
  const v = input[key];
  if (typeof v !== "string" || !v.trim()) {
    throw new Error(`Tool input missing required string field: '${key}'`);
  }
  return v;
}

function optionalString(input: ToolInput, key: string): string | undefined {
  const v = input[key];
  return typeof v === "string" ? v : undefined;
}

function optionalNumber(input: ToolInput, key: string): number | undefined {
  const v = input[key];
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  return isNaN(n) ? undefined : n;
}
