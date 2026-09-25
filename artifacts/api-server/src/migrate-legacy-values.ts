/**
 * migrate-legacy-values.ts
 *
 * One-time (idempotent) normalisation of legacy task priority / status values
 * that were seeded before the canonical taxonomy was established.
 *
 * Canonical values
 *   priority : urgent | high | medium | low
 *   status   : todo   | in_progress | done | blocked | needs_input
 *
 * Legacy → canonical mappings
 *   priority "critical"     → "urgent"
 *   priority "normal"       → "medium"
 *   priority "low-priority" → "low"
 *   status   "in-progress"  → "in_progress"   (hyphen variant)
 *   status   "complete"     → "done"
 *   status   "completed"    → "done"
 *   status   "open"         → "todo"
 *
 * Any remaining unrecognised priority falls back to "medium".
 * Any remaining unrecognised status  falls back to "todo".
 *
 * All UPDATEs run inside a single transaction — either all rows are
 * normalised or none are, preventing a partially-cleaned state.
 *
 * The function awaits completion before returning, so callers can rely on
 * the DB being fully normalised once it resolves.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger";

export async function migrateLegacyTaskValues(): Promise<void> {
  let totalFixed = 0;

  await db.transaction(async (tx) => {
    // ── Priority: known mappings ──────────────────────────────────────────
    const priorityMappings: Array<[string, string]> = [
      ["critical",     "urgent"],
      ["normal",       "medium"],
      ["low-priority", "low"],
    ];

    for (const [legacy, canonical] of priorityMappings) {
      const result = await tx.execute(
        sql`UPDATE tasks SET priority = ${canonical} WHERE priority = ${legacy}`,
      );
      const count = (result as unknown as { rowCount: number }).rowCount ?? 0;
      if (count > 0) {
        logger.info({ legacy, canonical, count }, "Normalised task priority");
        totalFixed += count;
      }
    }

    // ── Priority: unknown fallback → "medium" ─────────────────────────────
    const unknownPriority = await tx.execute(
      sql`UPDATE tasks SET priority = 'medium'
          WHERE priority NOT IN ('urgent','high','medium','low')`,
    );
    const upCount = (unknownPriority as unknown as { rowCount: number }).rowCount ?? 0;
    if (upCount > 0) {
      logger.warn({ count: upCount }, "Normalised unknown priority values → medium");
      totalFixed += upCount;
    }

    // ── Status: known mappings ────────────────────────────────────────────
    const statusMappings: Array<[string, string]> = [
      ["in-progress", "in_progress"],
      ["complete",    "done"],
      ["completed",   "done"],
      ["open",        "todo"],
    ];

    for (const [legacy, canonical] of statusMappings) {
      const result = await tx.execute(
        sql`UPDATE tasks SET status = ${canonical} WHERE status = ${legacy}`,
      );
      const count = (result as unknown as { rowCount: number }).rowCount ?? 0;
      if (count > 0) {
        logger.info({ legacy, canonical, count }, "Normalised task status");
        totalFixed += count;
      }
    }

    // ── Status: unknown fallback → "todo" ─────────────────────────────────
    const unknownStatus = await tx.execute(
      sql`UPDATE tasks SET status = 'todo'
          WHERE status NOT IN ('todo','in_progress','done','blocked','needs_input')`,
    );
    const usCount = (unknownStatus as unknown as { rowCount: number }).rowCount ?? 0;
    if (usCount > 0) {
      logger.warn({ count: usCount }, "Normalised unknown status values → todo");
      totalFixed += usCount;
    }
  });

  if (totalFixed === 0) {
    logger.info("migrateLegacyTaskValues: no stale rows found — DB is clean");
  } else {
    logger.info({ totalFixed }, "migrateLegacyTaskValues: normalisation complete");
  }
}
