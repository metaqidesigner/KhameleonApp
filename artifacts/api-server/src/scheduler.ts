import { db, settingsTable } from '@workspace/db';
import { inArray } from 'drizzle-orm';
import { findAgent } from './agents/defaults.js';
import { askAgent } from './agents/gateway.js';
import { logger } from './lib/logger.js';

// ── Scheduler config keys ──────────────────────────────────────

const KEY_ENABLED       = 'scheduler.enabled';
const KEY_DIGEST_HOUR   = 'scheduler.digestHour';
const KEY_DIGEST_MINUTE = 'scheduler.digestMinute';

// ── Types ─────────────────────────────────────────────────────

export interface SchedulerConfig {
  enabled:      boolean;
  digestHour:   number;   // 0–23
  digestMinute: number;   // 0–59
}

export interface SchedulerStatus extends SchedulerConfig {
  nextRunAt: string | null;   // ISO timestamp
  lastRunAt: string | null;   // ISO timestamp
}

// ── In-memory state (seeded from DB on startup) ───────────────

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

// ── DB persistence helpers ────────────────────────────────────

/**
 * Read all scheduler-related settings from the database and apply them to in-memory state.
 * Falls back to the current in-memory defaults if a key is missing or invalid.
 */
async function loadConfigFromDb(): Promise<void> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, [KEY_ENABLED, KEY_DIGEST_HOUR, KEY_DIGEST_MINUTE]));

  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  if (map[KEY_ENABLED] !== undefined) {
    state.enabled = map[KEY_ENABLED] === 'true';
  }

  if (map[KEY_DIGEST_HOUR] !== undefined) {
    const h = Number(map[KEY_DIGEST_HOUR]);
    if (Number.isInteger(h) && h >= 0 && h <= 23) state.digestHour = h;
  }

  if (map[KEY_DIGEST_MINUTE] !== undefined) {
    const m = Number(map[KEY_DIGEST_MINUTE]);
    if (Number.isInteger(m) && m >= 0 && m <= 59) state.digestMinute = m;
  }

  logger.info(
    { enabled: state.enabled, digestHour: state.digestHour, digestMinute: state.digestMinute },
    'Scheduler: config loaded from database',
  );
}

/**
 * Persist the current in-memory config to the database atomically.
 * All three keys are upserted inside a single transaction so a partial
 * write can never leave the DB in an inconsistent state.
 */
async function saveConfigToDb(): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [key, value] of [
      [KEY_ENABLED,       String(state.enabled)],
      [KEY_DIGEST_HOUR,   String(state.digestHour)],
      [KEY_DIGEST_MINUTE, String(state.digestMinute)],
    ] as const) {
      await tx
        .insert(settingsTable)
        .values({ key, value })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
    }
  });
}

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
 * Initialise the scheduler: load persisted config from the database, then start the timer.
 * Call once on server startup instead of startScheduler().
 */
export async function initScheduler(): Promise<void> {
  try {
    await loadConfigFromDb();
  } catch (err) {
    logger.error({ err }, 'Scheduler: failed to load config from DB — using defaults');
  }
  scheduleNextTick();
}

/**
 * Start the daily morning-digest scheduler (no DB load — kept for backward compatibility).
 * Prefer initScheduler() for new code.
 */
export function startScheduler(): void {
  scheduleNextTick();
}

/**
 * Cancel any pending scheduler timer.
 * Primarily used in tests to let the process exit cleanly.
 */
export function stopScheduler(): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
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
 * Update scheduler config, persist to the database, and reschedule.
 * All values MUST already be validated by the caller — this function trusts its input.
 *
 * If the database write fails, the in-memory state is rolled back to its previous
 * values and the error is re-thrown so the caller can return a 500 to the client.
 * The scheduler timer is NOT rescheduled on failure.
 */
export async function updateSchedulerConfig(patch: Partial<SchedulerConfig>): Promise<SchedulerStatus> {
  // Snapshot previous state so we can roll back on failure
  const prev: SchedulerConfig = {
    enabled:      state.enabled,
    digestHour:   state.digestHour,
    digestMinute: state.digestMinute,
  };

  if (patch.enabled      !== undefined) state.enabled      = patch.enabled;
  if (patch.digestHour   !== undefined) state.digestHour   = patch.digestHour;
  if (patch.digestMinute !== undefined) state.digestMinute = patch.digestMinute;

  try {
    await saveConfigToDb();
  } catch (err) {
    // Roll back in-memory state so it stays consistent with the DB
    state.enabled      = prev.enabled;
    state.digestHour   = prev.digestHour;
    state.digestMinute = prev.digestMinute;
    logger.error({ err }, 'Scheduler: failed to persist config to DB — state rolled back');
    throw err;
  }

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
