/**
 * Security guardrail: Rate Limiter (khameleon-decisions-log.md, 2026-10-01).
 * Caps how often an agent can call tools through dispatcher.ts - the one
 * choke point every tool call already passes through.
 *
 * Global, not per-session: this is a single-tenant app (SELF_HOSTING.md) -
 * one real server-wide counter is an honest match for that architecture,
 * not a per-user system this app doesn't have the identity model for.
 *
 * Two tiers, not one flat cap: write_file/run_command/run_build can modify
 * the filesystem or execute shell commands, so they get a much tighter
 * window than read-only tools (read_file, list_files, fetch_url, task
 * CRUD, etc.) - a runaway read loop is a cost/noise problem, a runaway
 * write loop is a real risk.
 */

const WRITE_TIER_TOOLS = new Set(["write_file", "run_command", "run_build"]);

const WRITE_TIER_LIMIT = 20;
const WRITE_TIER_WINDOW_MS = 5 * 60 * 1000;
const STANDARD_TIER_LIMIT = 100;
const STANDARD_TIER_WINDOW_MS = 5 * 60 * 1000;

const writeCalls: number[] = [];
const standardCalls: number[] = [];

function pruneOld(timestamps: number[], windowMs: number): void {
  const cutoff = Date.now() - windowMs;
  while (timestamps.length && timestamps[0] < cutoff) timestamps.shift();
}

/** Throws if the call would exceed the relevant tier's rate limit; otherwise records it. */
export function checkToolRateLimit(toolName: string): void {
  const isWriteTier = WRITE_TIER_TOOLS.has(toolName);
  const timestamps = isWriteTier ? writeCalls : standardCalls;
  const limit = isWriteTier ? WRITE_TIER_LIMIT : STANDARD_TIER_LIMIT;
  const windowMs = isWriteTier ? WRITE_TIER_WINDOW_MS : STANDARD_TIER_WINDOW_MS;

  pruneOld(timestamps, windowMs);

  if (timestamps.length >= limit) {
    const tier = isWriteTier ? "file-write/command" : "read/standard";
    throw new Error(
      `Rate limit exceeded: ${limit} ${tier} tool calls per ${windowMs / 60_000} minute(s). ` +
        `Try again shortly, or break this into smaller steps.`
    );
  }

  timestamps.push(Date.now());
}

/** Test-only: clears both counters so tests don't leak state into each other. Not used by any real call path. */
export function __resetRateLimiterForTests(): void {
  writeCalls.length = 0;
  standardCalls.length = 0;
}
