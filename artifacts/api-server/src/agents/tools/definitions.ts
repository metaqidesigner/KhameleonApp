import type Anthropic from "@anthropic-ai/sdk";

/** Tool definitions in Claude's tool_use format. */
export const TOOL_DEFINITIONS: Anthropic.Messages.Tool[] = [
  {
    name: "read_file",
    description:
      "Read the full contents of a file in the Khameleon workspace. Returns the file content as a string. Useful for inspecting source code, configs, or logs.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Workspace-relative path to the file, e.g. 'artifacts/nexus-command/src/pages/inbox.tsx'.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Write or overwrite a file in the workspace. Creates parent directories if needed. Use with care — the change is immediate.",
    input_schema: {
      type: "object",
      properties: {
        path:    { type: "string", description: "Workspace-relative path." },
        content: { type: "string", description: "Full file content to write." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_files",
    description:
      "List files in a workspace directory. Optionally filter by a glob pattern. Returns newline-separated paths.",
    input_schema: {
      type: "object",
      properties: {
        dir: {
          type: "string",
          description: "Workspace-relative directory to list, e.g. 'artifacts/api-server/src'.",
        },
        pattern: {
          type: "string",
          description: "Optional glob pattern, e.g. '*.ts' or '**/*.tsx'.",
        },
      },
      required: ["dir"],
    },
  },
  {
    name: "run_build",
    description:
      "Run `pnpm build` for a specific workspace package and return stdout/stderr. Package name is the short name after @workspace/, e.g. 'nexus-command' or 'api-server'.",
    input_schema: {
      type: "object",
      properties: {
        package: {
          type: "string",
          description: "Package short name, e.g. 'nexus-command', 'api-server', 'db'.",
        },
      },
      required: ["package"],
    },
  },
  {
    name: "run_command",
    description:
      "Run a shell command from an approved whitelist. Allowed commands: git status, git log, git diff, pnpm build, pnpm test, find, cat (non-secret files). Anything outside the whitelist is rejected.",
    input_schema: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The exact shell command to run, e.g. 'git status' or 'find artifacts/api-server/src -name \"*.ts\"'.",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "git_status",
    description:
      "Return the current `git status --short` output showing modified, staged, and untracked files in the workspace.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "git_log",
    description: "Return recent git commit history.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of commits to return (default 10, max 50).",
        },
      },
      required: [],
    },
  },
  {
    name: "check_workflow",
    description:
      "Check which workflows/services are currently listening on ports. Returns a summary of active ports and process names.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_logs",
    description:
      "Read the most recent lines from workflow log files in /tmp/logs/. Returns log content from the most recently written log file.",
    input_schema: {
      type: "object",
      properties: {
        lines: {
          type: "number",
          description: "Number of recent lines to return (default 100, max 500).",
        },
        filter: {
          type: "string",
          description: "Optional substring to grep for in the logs.",
        },
      },
      required: [],
    },
  },
  // ── Task management tools ──────────────────────────────────────────────────
  {
    name: "create_task",
    description:
      "Create a new task in the Khameleon task system. Use this to add tasks during morning digest generation, orchestrator decomposition, or any time you need to track an action item.",
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Clear, actionable task title.",
        },
        description: {
          type: "string",
          description: "Optional additional context or notes.",
        },
        category: {
          type: "string",
          enum: ["communication", "meetings", "deep_work", "task_project_management", "administrative", "planning"],
          description: "Task category: communication (emails/chat), meetings (prep/notes/AIs), deep_work (primary deliverables), task_project_management (status/blockers), administrative (expenses/approvals), planning (prioritization).",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low"],
          description: "Task priority level.",
        },
        recurrence: {
          type: "string",
          enum: ["one_off", "daily", "weekly", "custom"],
          description: "How often this task recurs. Use daily/weekly for standing tasks.",
        },
        due_date: {
          type: "string",
          description: "Optional due date in YYYY-MM-DD format.",
        },
        parent_task_id: {
          type: "number",
          description: "Optional parent task ID — use when creating subtasks under a Deep Work task.",
        },
        calendar_event_id: {
          type: "string",
          description: "Optional ID of a related calendar event.",
        },
        thread_id: {
          type: "string",
          description: "Optional ID of a related email or chat thread.",
        },
      },
      required: ["title", "category"],
    },
  },
  {
    name: "list_tasks",
    description:
      "List tasks from the Khameleon task system, optionally filtered. Returns JSON array of tasks. Use before creating a morning digest to see what's already tracked.",
    input_schema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["communication", "meetings", "deep_work", "task_project_management", "administrative", "planning"],
          description: "Filter by category.",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low"],
          description: "Filter by priority.",
        },
        recurrence: {
          type: "string",
          enum: ["one_off", "daily", "weekly", "custom"],
          description: "Filter by recurrence.",
        },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done", "blocked"],
          description: "Filter by status. Defaults to excluding 'done' tasks.",
        },
        limit: {
          type: "number",
          description: "Max number of tasks to return (default 50).",
        },
      },
      required: [],
    },
  },
  {
    name: "update_task",
    description:
      "Update an existing task's fields (status, priority, category, etc.).",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "number",
          description: "Task ID to update.",
        },
        status: {
          type: "string",
          enum: ["todo", "in_progress", "done", "blocked"],
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low"],
        },
        category: {
          type: "string",
          enum: ["communication", "meetings", "deep_work", "task_project_management", "administrative", "planning"],
        },
        title: { type: "string" },
        description: { type: "string" },
      },
      required: ["id"],
    },
  },
];
