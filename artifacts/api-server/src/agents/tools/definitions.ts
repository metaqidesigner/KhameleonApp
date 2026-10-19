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
            "Workspace-relative path to the file, e.g. 'artifacts/khameleon-command/src/pages/inbox.tsx'.",
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
      "Run `pnpm build` for a specific workspace package and return stdout/stderr. Package name is the short name after @workspace/, e.g. 'khameleon-command' or 'api-server'.",
    input_schema: {
      type: "object",
      properties: {
        package: {
          type: "string",
          description: "Package short name, e.g. 'khameleon-command', 'api-server', 'db'.",
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
  // ── Research tools ──────────────────────────────────────────────────────
  {
    name: "fetch_url",
    description:
      "Fetch a web page or API endpoint (http/https only) and return its readable text content. Use this for real research — reading articles, documentation, or reference pages — rather than relying on prior knowledge. Cannot execute JavaScript, so fully client-rendered pages may return little content. Refuses private/internal addresses.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Full http:// or https:// URL to fetch.",
        },
      },
      required: ["url"],
    },
  },
  // ── Work tools (read-only): calendar ──────────────────────────────────────
  {
    name: "get_calendar",
    description:
      "Read the user's calendar (read-only). Use for questions like 'what's on this afternoon?', 'am I free tomorrow?', 'what meetings do I have this week?'. Returns each event's time, title, place and the other people in it.",
    input_schema: {
      type: "object",
      properties: {
        when: {
          type: "string",
          description: "Which period: 'today' (the rest of today), 'this afternoon', 'tomorrow', 'this week', 'next week', or a date as YYYY-MM-DD.",
        },
      },
      required: [],
    },
  },
  {
    name: "sign_in_with_saved_login",
    description:
      "Sign in to a website or app with one of the user's saved logins (Settings > Credentials). Khameleon asks the user first, then types the user name and password into the sign-in form itself - you never see or handle the password. Use when a skill's steps need you to sign in. Put the sign-in page in front first (with desktop_apps or desktop_files). If the result starts with FAILED, stop and tell the user.",
    input_schema: {
      type: "object",
      properties: {
        login: { type: "string", description: "The saved login's name, e.g. 'Supplier portal'." },
        app: { type: "string", description: "Optional: the app or browser window showing the sign-in page, e.g. 'Chrome'." },
      },
      required: ["login"],
    },
  },
  {
    name: "desktop_apps",
    description:
      "Work inside an app window that is already open on the user's computer. Instructions: 'observe <app>' (watch it), 'control <app>' (work in it - the user is asked to allow it), 'type \"<text>\" into <app>' (types where the cursor is), 'stop controlling'. To OPEN or QUIT an app use desktop_files instead. One instruction per call.",
    input_schema: {
      type: "object",
      properties: { command: { type: "string", description: "One short instruction." } },
      required: ["command"],
    },
  },
  {
    name: "desktop_files",
    description:
      "Open or quit apps, and manage files, on the user's computer. Instructions: 'open <app>', 'quit <app>', 'create folder <name>', 'move <file> to <folder>', 'trash <file>' (recoverable), 'sort <folder>'. One instruction per call.",
    input_schema: {
      type: "object",
      properties: { command: { type: "string", description: "One short instruction." } },
      required: ["command"],
    },
  },
  {
    name: "check_inbox",
    description:
      "Look at the user's unread email (read-only) and report what's urgent, what needs action, and what's just FYI - with why. Use for 'anything urgent?', 'what's in my inbox?', 'do I need to reply to anything?'. Never moves, flags or marks anything.",
    input_schema: {
      type: "object",
      properties: { focus: { type: "string", description: "Optional: 'urgent' to list only urgent mail." } },
      required: [],
    },
  },
  {
    name: "prepare_meeting_brief",
    description:
      "Prepare a short brief for one of the user's meetings: who's in it, recent emails from them, related open tasks, when they last met, and points to raise. Use for 'prep me for the 3pm', 'brief me on my meeting with Jane'.",
    input_schema: {
      type: "object",
      properties: {
        meeting: { type: "string", description: "Which meeting, in the user's words - a time ('3pm', '15:30'), a name ('the Q3 review'), a person ('Jane'), or 'next'." },
      },
      required: ["meeting"],
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
