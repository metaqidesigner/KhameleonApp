import { findAgent } from './agents/defaults.js';
import { askAgent } from './agents/gateway.js';
import { logger } from './lib/logger.js';

// ── In-memory scheduler state ─────────────────────────────────

export interface SchedulerConfig {
  enabled:      boolean;
  digestHour:   number;   // 0–23
  digestMinute: number;   // 0–59
}

export interface SchedulerStatus extends SchedulerConfig {
  nextRunAt: string | null;   // ISO timestamp
  lastRunAt: string | null;   // ISO timestamp
}

/** Parse an integer from an environment variable, returning the fallback if invalid/out-of-range. */
function envInt(key: string, fallback: number, min: number, max: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    logger.warn(
      { key, raw, fallback },
      `Scheduler: invalid env var ${key} — using default ${fallback}`,
    );
    return fallback;
  }
  return n;
}

const state: SchedulerConfig & { lastRunAt: string | null } = {
  enabled:      true,
  digestHour:   envInt('DIGEST_HOUR',   7, 0, 23),
  digestMinute: envInt('DIGEST_MINUTE', 0, 0, 59),
  lastRunAt:    null,
};

let pendingTimer: ReturnType<typeof setTimeout> | null = null;

// ── Helpers ───────────────────────────────────────────────────

function msUntilNext(hour: number, minute: number): number {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function nextRunDate(): Date | null {
  if (!state.enabled) return null;
  const now  = new Date();
  const next = new Date(now);
  next.setHours(state.digestHour, state.digestMinute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

// ── Runner ────────────────────────────────────────────────────

async function runMorningDigest(): Promise<void> {
  const agent = findAgent('morning_digest');
  if (!agent) {
    logger.warn('Scheduler: morning_digest agent not found in roster');
    return;
  }

  const today = new Date().toLocaleDateString('en-AU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  logger.info({ today }, 'Scheduler: starting morning digest');
  state.lastRunAt = new Date().toISOString();

  const result = await askAgent(agent, [
    {
      role: 'user',
      content:
        `Good morning! Please generate today's morning digest for ${today}. ` +
        `Review existing tasks using list_tasks, then create a balanced, categorised daily plan with create_task. ` +
        `Cover all six time buckets: Start of Day, Core Work, Meetings, Communication, Administrative, and End of Day.`,
    },
  ]);

  if (result.error) {
    logger.error({ error: result.error }, 'Scheduler: morning digest returned an error');
  } else {
    logger.info(
      { tokens: result.tokens, latencyMs: result.latencyMs, toolCalls: result.toolCalls?.length ?? 0 },
      'Scheduler: morning digest complete',
    );
  }
}

// ── Scheduler loop ────────────────────────────────────────────

function scheduleNextTick(): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }

  if (!state.enabled) {
    logger.info('Scheduler: disabled — no next run scheduled');
    return;
  }

  const ms = msUntilNext(state.digestHour, state.digestMinute);
  const hh = Math.floor(ms / 3_600_000);
  const mm = Math.floor((ms % 3_600_000) / 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');

  logger.info(
    { nextRunIn: `${hh}h ${mm}m`, time: `${pad(state.digestHour)}:${pad(state.digestMinute)}` },
    'Scheduler: morning digest scheduled',
  );

  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    runMorningDigest().catch((err) =>
      logger.error({ err }, 'Scheduler: unhandled error in morning digest'),
    );
    // Schedule the next run exactly 24 hours after this one fires
    scheduleNextTick();
  }, safeMs(ms));
}

// ── Public API ────────────────────────────────────────────────

/**
 * Start the daily morning-digest scheduler.
 * Called once on server startup.
 */
export function startScheduler(): void {
  scheduleNextTick();
}

/**
 * Return current scheduler status (for the API route).
 */
export function getSchedulerStatus(): SchedulerStatus {
  const nextDate = nextRunDate();
  return {
    enabled:      state.enabled,
    digestHour:   state.digestHour,
    digestMinute: state.digestMinute,
    nextRunAt:    nextDate ? nextDate.toISOString() : null,
    lastRunAt:    state.lastRunAt,
  };
}

/**
 * Update scheduler config and reschedule.
 * All values MUST already be validated by the caller — this function trusts its input.
 */
export function updateSchedulerConfig(patch: Partial<SchedulerConfig>): SchedulerStatus {
  if (patch.enabled      !== undefined) state.enabled      = patch.enabled;
  if (patch.digestHour   !== undefined) state.digestHour   = patch.digestHour;
  if (patch.digestMinute !== undefined) state.digestMinute = patch.digestMinute;

  scheduleNextTick();
  return getSchedulerStatus();
}

/**
 * Defensive guard inside the tick — refuse to run if the scheduled time is somehow non-finite.
 * Should never happen after proper validation, but this is a belt-and-suspenders check.
 */
function safeMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) {
    logger.error({ ms }, 'Scheduler: computed ms-until-next is invalid — defaulting to 24 h');
    return 24 * 60 * 60 * 1000;
  }
  return ms;
}
