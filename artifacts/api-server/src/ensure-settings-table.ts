/**
 * ensure-settings-table.ts
 *
 * Idempotent DDL bootstrap: creates the `settings` table if it does not exist.
 * Run once during server startup before any scheduler config reads or writes.
 *
 * Using raw SQL so the table is guaranteed to exist even on fresh deployments
 * where drizzle-kit push has not been run manually.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger.js";

export async function ensureSettingsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  logger.info("ensureSettingsTable: settings table ready");
}
