/**
 * Integration test for scheduler config DB persistence.
 *
 * Verifies that:
 *  1. updateSchedulerConfig writes through to the settings table.
 *  2. initScheduler reloads the persisted config from DB.
 *  3. A DB write failure rolls back in-memory state and throws.
 *
 * Run with:  pnpm --filter @workspace/api-server run test:scheduler
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { db, settingsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  initScheduler,
  updateSchedulerConfig,
  getSchedulerStatus,
  stopScheduler,
} from "./scheduler.js";
import { ensureSettingsTable } from "./ensure-settings-table.js";

// ── Keys written by the scheduler ────────────────────────────────────────────

const SCHEDULER_KEYS = [
  "scheduler.enabled",
  "scheduler.digestHour",
  "scheduler.digestMinute",
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function clearSchedulerSettings(): Promise<void> {
  await db
    .delete(settingsTable)
    .where(inArray(settingsTable.key, [...SCHEDULER_KEYS]));
}

async function readSchedulerSettings(): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, [...SCHEDULER_KEYS]));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

before(async () => {
  await ensureSettingsTable();
  await clearSchedulerSettings();
});

after(async () => {
  stopScheduler();            // cancel pending setTimeout so process can exit
  await clearSchedulerSettings();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test("updateSchedulerConfig: persists config to the database", async () => {
  await updateSchedulerConfig({ enabled: false, digestHour: 9, digestMinute: 30 });

  const settings = await readSchedulerSettings();

  assert.equal(settings["scheduler.enabled"],      "false", "enabled persisted");
  assert.equal(settings["scheduler.digestHour"],   "9",     "digestHour persisted");
  assert.equal(settings["scheduler.digestMinute"], "30",    "digestMinute persisted");
});

test("initScheduler: reloads persisted config from DB on startup", async () => {
  // Write known values directly into the DB (simulating a previous save)
  for (const [key, value] of [
    ["scheduler.enabled",      "true"],
    ["scheduler.digestHour",   "14"],
    ["scheduler.digestMinute", "45"],
  ] as const) {
    await db
      .insert(settingsTable)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settingsTable.key,
        set: { value, updatedAt: new Date() },
      });
  }

  await initScheduler();

  const status = getSchedulerStatus();
  assert.equal(status.enabled,      true, "enabled reloaded from DB");
  assert.equal(status.digestHour,   14,   "digestHour reloaded from DB");
  assert.equal(status.digestMinute, 45,   "digestMinute reloaded from DB");
});

test("updateSchedulerConfig: rolls back in-memory state when DB write fails", async () => {
  // Seed a known state first
  await updateSchedulerConfig({ enabled: true, digestHour: 8, digestMinute: 0 });
  const stateBefore = getSchedulerStatus();

  // Drop the settings table to force a DB write failure
  await db.execute(sql`ALTER TABLE settings RENAME TO settings_disabled`);

  try {
    await assert.rejects(
      () => updateSchedulerConfig({ enabled: false, digestHour: 23, digestMinute: 59 }),
      "updateSchedulerConfig must throw when DB write fails",
    );

    // In-memory state must be rolled back to the pre-attempt values
    const stateAfter = getSchedulerStatus();
    assert.equal(stateAfter.enabled,      stateBefore.enabled,      "enabled rolled back");
    assert.equal(stateAfter.digestHour,   stateBefore.digestHour,   "digestHour rolled back");
    assert.equal(stateAfter.digestMinute, stateBefore.digestMinute, "digestMinute rolled back");
  } finally {
    // Always restore the table so subsequent tests and teardown work
    await db.execute(sql`ALTER TABLE settings_disabled RENAME TO settings`);
  }
});
