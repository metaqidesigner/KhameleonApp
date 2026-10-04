/**
 * Shell tool implementations for the Khameleon agentic loop.
 * All file I/O is scoped to the workspace root.
 * All exec calls are async to avoid blocking the event loop.
 */

import { exec } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ── Workspace root ────────────────────────────────────────────
// The API server runs from artifacts/api-server/; go up two levels to reach the workspace root.
const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");

// ── Blocked path segments (never allow reads/writes here) ─────
// Security guardrail: File Policy (khameleon-decisions-log.md, 2026-10-01).
// Widened from a .git/objects-only block to the whole .git/ directory
// (write_file could previously overwrite .git/config or hooks), plus
// common credential-file locations outside this repo's own secrets.
const BLOCKED_SEGMENTS = [
  ".env", ".env.", "secrets", "/proc/", "/sys/", "/etc/shadow",
  "/etc/passwd", "node_modules/.cache", "/.git/", ".ssh/", "id_rsa",
  ".npmrc", "/.aws/", ".docker/config.json",
];

// Write-size cap, mirroring readFile's existing 500_000-byte read cap -
// large writes are more likely to be a runaway/mistaken tool call than a
// genuine source-file edit.
const MAX_WRITE_BYTES = 1_000_000;

function assertSafePath(p: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, p);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error(`Path escapes workspace root: ${p}`);
  }
  const lower = resolved.toLowerCase();
  for (const blocked of BLOCKED_SEGMENTS) {
    if (lower.includes(blocked)) {
      throw new Error(`Access to blocked path segment '${blocked}': ${p}`);
    }
  }
  return resolved;
}

// ── read_file ─────────────────────────────────────────────────
export async function readFile(p: string): Promise<string> {
  const abs = assertSafePath(p);
  if (!fs.existsSync(abs)) throw new Error(`File not found: ${p}`);
  const stat = fs.statSync(abs);
  if (stat.size > 500_000) throw new Error(`File too large to read (${stat.size} bytes). Use read_logs or list_files instead.`);
  return fs.readFileSync(abs, "utf8");
}

// ── write_file ────────────────────────────────────────────────
export async function writeFile(p: string, content: string): Promise<string> {
  const abs = assertSafePath(p);
  if (Buffer.byteLength(content, "utf8") > MAX_WRITE_BYTES) {
    throw new Error(`Write refused: content is larger than the ${MAX_WRITE_BYTES}-byte limit for a single write_file call.`);
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  return `OK: wrote ${content.length} bytes to ${p}`;
}

// ── list_files ────────────────────────────────────────────────
export async function listFiles(dir: string, pattern?: string): Promise<string> {
  const absDir = assertSafePath(dir);
  if (!fs.existsSync(absDir)) throw new Error(`Directory not found: ${dir}`);
  const cmd = pattern
    ? `find "${absDir}" -name "${pattern}" -type f 2>/dev/null | head -200`
    : `find "${absDir}" -type f 2>/dev/null | head -200`;
  const { stdout } = await execAsync(cmd, { timeout: 10_000 });
  // Convert absolute paths back to workspace-relative
  return stdout
    .split("\n")
    .filter(Boolean)
    .map((l) => l.replace(WORKSPACE_ROOT + "/", ""))
    .join("\n");
}

// ── run_build ─────────────────────────────────────────────────
export async function runBuild(pkg: string): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(pkg)) throw new Error(`Invalid package name: ${pkg}`);
  try {
    const { stdout, stderr } = await execAsync(
      `pnpm --filter "@workspace/${pkg}" run build`,
      { cwd: WORKSPACE_ROOT, timeout: 120_000 }
    );
    return `BUILD SUCCESS\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`.trim();
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return `BUILD FAILED\n--- stdout ---\n${e.stdout ?? ""}\n--- stderr ---\n${e.stderr ?? e.message ?? ""}`.trim();
  }
}

// ── run_command (whitelist-enforced) ──────────────────────────
const ALLOWED_PREFIXES = [
  "git status", "git log", "git diff", "git show",
  "pnpm build", "pnpm test", "pnpm --filter",
  "find ", "cat ",
];

export async function runCommand(command: string): Promise<string> {
  const trimmed = command.trim();
  const allowed = ALLOWED_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  if (!allowed) {
    throw new Error(
      `Command not in whitelist: '${trimmed.slice(0, 60)}'. ` +
        `Allowed prefixes: ${ALLOWED_PREFIXES.join(", ")}.`
    );
  }
  // Extra guard: block shell metacharacters that could escape the intent
  if (/[;&|`$]/.test(trimmed)) {
    throw new Error(`Shell metacharacters not allowed in command: ${trimmed.slice(0, 60)}`);
  }
  // For `cat`, enforce path safety
  if (trimmed.startsWith("cat ")) {
    const filePath = trimmed.slice(4).trim();
    assertSafePath(filePath);
  }
  try {
    const { stdout, stderr } = await execAsync(trimmed, {
      cwd: WORKSPACE_ROOT,
      timeout: 30_000,
    });
    return (stdout + (stderr ? `\n[stderr]: ${stderr}` : "")).trim() || "(no output)";
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return `EXIT ERROR\n${e.stdout ?? ""}\n${e.stderr ?? e.message ?? ""}`.trim();
  }
}

// ── git_status ────────────────────────────────────────────────
export async function gitStatus(): Promise<string> {
  try {
    const { stdout } = await execAsync("git status --short", {
      cwd: WORKSPACE_ROOT,
      timeout: 10_000,
    });
    return stdout.trim() || "Working tree clean — no changes.";
  } catch (err: unknown) {
    return `git status failed: ${(err as Error).message}`;
  }
}

// ── git_log ───────────────────────────────────────────────────
export async function gitLog(limit = 10): Promise<string> {
  const n = Math.min(Math.max(1, limit), 50);
  try {
    const { stdout } = await execAsync(
      `git log --oneline --decorate -${n}`,
      { cwd: WORKSPACE_ROOT, timeout: 10_000 }
    );
    return stdout.trim() || "No commits found.";
  } catch (err: unknown) {
    return `git log failed: ${(err as Error).message}`;
  }
}

// ── check_workflow ────────────────────────────────────────────
export async function checkWorkflow(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      "ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null",
      { timeout: 5_000 }
    );
    return stdout.trim() || "No active listening ports found.";
  } catch {
    try {
      const { stdout } = await execAsync("lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null", { timeout: 5_000 });
      return stdout.trim() || "No active ports found via lsof.";
    } catch {
      return "Could not determine workflow status.";
    }
  }
}

// ── read_logs ─────────────────────────────────────────────────
export async function readLogs(lines = 100, filter?: string): Promise<string> {
  const n = Math.min(Math.max(1, lines), 500);
  try {
    const listCmd = "ls -t /tmp/logs/*.log 2>/dev/null | head -3";
    const { stdout: fileList } = await execAsync(listCmd, { timeout: 5_000 });
    const files = fileList.trim().split("\n").filter(Boolean);
    if (!files.length) return "No log files found in /tmp/logs/.";

    const tailCmd = filter
      ? `tail -n ${n} ${files[0]} | grep -i "${filter.replace(/"/g, '\\"')}" || true`
      : `tail -n ${n} ${files[0]}`;

    const { stdout } = await execAsync(tailCmd, { timeout: 5_000 });
    return `[${files[0]}]\n${stdout.trim()}` || "Log file is empty.";
  } catch (err: unknown) {
    return `Could not read logs: ${(err as Error).message}`;
  }
}
