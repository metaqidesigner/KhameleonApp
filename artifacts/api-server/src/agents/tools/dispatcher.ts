/**
 * Tool dispatcher — the security boundary between Claude's tool calls and the shell.
 * Every tool Claude requests passes through here before any execution.
 */

import {
  readFile, writeFile, listFiles, runBuild, runCommand,
  gitStatus, gitLog, checkWorkflow, readLogs,
} from "./shell.js";
import { createTask, listTasks, updateTask } from "./taskOps.js";
import { fetchUrl } from "./webFetch.js";

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

    // ── Research tools ────────────────────────────────────────────────────
    case "fetch_url": {
      const url = requireString(input, "url");
      return fetchUrl(url);
    }

    // ── Task management tools ──────────────────────────────────────────────
    case "create_task": {
      const title           = requireString(input, "title");
      const category        = optionalString(input, "category") ?? "deep_work";
      const priority        = optionalString(input, "priority") ?? "medium";
      const recurrence      = optionalString(input, "recurrence") ?? "one_off";
      const description     = optionalString(input, "description");
      const dueDate         = optionalString(input, "due_date");
      const parentTaskId    = optionalNumber(input, "parent_task_id");
      const calendarEventId = optionalString(input, "calendar_event_id");
      const threadId        = optionalString(input, "thread_id");
      return createTask({ title, category, priority, recurrence, description, dueDate, parentTaskId, calendarEventId, threadId });
    }

    case "list_tasks": {
      const category   = optionalString(input, "category");
      const priority   = optionalString(input, "priority");
      const recurrence = optionalString(input, "recurrence");
      const status     = optionalString(input, "status");
      const limit      = optionalNumber(input, "limit");
      return listTasks({ category, priority, recurrence, status, limit: limit ?? undefined });
    }

    case "update_task": {
      const id          = requireNumber(input, "id");
      const patch: Record<string, string> = {};
      const status      = optionalString(input, "status");
      const priority    = optionalString(input, "priority");
      const category    = optionalString(input, "category");
      const title       = optionalString(input, "title");
      const description = optionalString(input, "description");
      if (status)      patch.status      = status;
      if (priority)    patch.priority    = priority;
      if (category)    patch.category    = category;
      if (title)       patch.title       = title;
      if (description) patch.description = description;
      return updateTask(id, patch);
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

function requireNumber(input: ToolInput, key: string): number {
  const v = input[key];
  const n = Number(v);
  if (v === undefined || v === null || isNaN(n)) {
    throw new Error(`Tool input missing required number field: '${key}'`);
  }
  return n;
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
