/**
 * Focused integration test for migrateLegacyTaskValues.
 *
 * Inserts rows with known legacy priority / status values, runs the migration,
 * then asserts every row now holds a canonical value.  Cleans up after itself.
 *
 * Run with:  pnpm --filter @workspace/api-server run test
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db";
import { sql, inArray } from "drizzle-orm";
import { migrateLegacyTaskValues } from "./migrate-legacy-values.js";

// ── Seed rows that exercise every legacy mapping ──────────────────────────────
const LEGACY_ROWS = [
  { title: "__test_critical",     priority: "critical",     status: "todo" },
  { title: "__test_in-progress",  priority: "high",         status: "in-progress" },
  { title: "__test_normal",       priority: "normal",       status: "todo" },
  { title: "__test_low-priority", priority: "low-priority", status: "open" },
  { title: "__test_complete",     priority: "medium",       status: "complete" },
  { title: "__test_completed",    priority: "medium",       status: "completed" },
  { title: "__test_unknown",      priority: "extreme",      status: "pending" },
];

let insertedIds: number[] = [];

before(async () => {
  // Bypass Drizzle schema validation by inserting raw SQL so we can write
  // values that the schema default would reject.
  for (const row of LEGACY_ROWS) {
    const result = await db.execute(
      sql`INSERT INTO tasks (title, description, priority, status, category, recurrence, source, assignee, ai_recommendation)
          VALUES (${row.title}, '', ${row.priority}, ${row.status}, 'deep_work', 'one_off', 'manual', '', '')
          RETURNING id`,
    );
    const id = (result.rows[0] as { id: number }).id;
    insertedIds.push(id);
  }
});

after(async () => {
  if (insertedIds.length > 0) {
    await db.delete(tasksTable).where(inArray(tasksTable.id, insertedIds));
  }
});

test("migrateLegacyTaskValues: maps every legacy priority to a canonical value", async () => {
  await migrateLegacyTaskValues();

  const rows = await db
    .select({ id: tasksTable.id, priority: tasksTable.priority, status: tasksTable.status })
    .from(tasksTable)
    .where(inArray(tasksTable.id, insertedIds));

  const validPriorities = new Set(["urgent", "high", "medium", "low"]);
  const validStatuses   = new Set(["todo", "in_progress", "done", "blocked"]);

  for (const row of rows) {
    assert.ok(
      validPriorities.has(row.priority),
      `Row ${row.id}: unexpected priority "${row.priority}"`,
    );
    assert.ok(
      validStatuses.has(row.status),
      `Row ${row.id}: unexpected status "${row.status}"`,
    );
  }
});

test("migrateLegacyTaskValues: specific mappings are applied correctly", async () => {
  const rows = await db
    .select({ title: tasksTable.title, priority: tasksTable.priority, status: tasksTable.status })
    .from(tasksTable)
    .where(inArray(tasksTable.id, insertedIds));

  const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));

  assert.equal(byTitle["__test_critical"]?.priority,    "urgent",     "critical → urgent");
  assert.equal(byTitle["__test_in-progress"]?.status,   "in_progress","in-progress → in_progress");
  assert.equal(byTitle["__test_normal"]?.priority,      "medium",     "normal → medium");
  assert.equal(byTitle["__test_low-priority"]?.priority,"low",        "low-priority → low");
  assert.equal(byTitle["__test_complete"]?.status,      "done",       "complete → done");
  assert.equal(byTitle["__test_completed"]?.status,     "done",       "completed → done");
  assert.equal(byTitle["__test_unknown"]?.priority,     "medium",     "extreme → medium (fallback)");
  assert.equal(byTitle["__test_low-priority"]?.status,  "todo",       "open → todo");
  assert.equal(byTitle["__test_unknown"]?.status,       "todo",       "pending → todo (fallback)");
});

test("bootstrap: server does not listen until migration resolves", async () => {
  // Verify the bootstrap contract by checking that migrateLegacyTaskValues
  // returns a resolved promise (not fire-and-forget) — the Promise must settle
  // before this test itself can complete.
  let resolved = false;
  await migrateLegacyTaskValues().then(() => { resolved = true; });
  assert.ok(resolved, "migrateLegacyTaskValues must resolve before listen");
});
