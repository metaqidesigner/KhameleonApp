/**
 * Builds 10-11: meeting briefs and the suggestion slot. Idempotent, safe on
 * every boot (same pattern as ensure-settings-table.ts). Matches
 * lib/db/src/schema/work_notices.ts.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger.js";

export async function ensureWorkTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS meeting_briefs (
      id SERIAL PRIMARY KEY,
      event_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      starts_at TIMESTAMPTZ NOT NULL,
      attendees JSONB NOT NULL DEFAULT '[]',
      brief TEXT NOT NULL,
      email_ids JSONB NOT NULL DEFAULT '[]',
      suggested_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS suggestions (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      why TEXT NOT NULL DEFAULT '',
      ref JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      dismissed_at TIMESTAMPTZ,
      opened_at TIMESTAMPTZ
    )
  `);
  // Build 7: saved logins for skills.
  await db.execute(sql`ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS username TEXT NOT NULL DEFAULT ''`);
  await db.execute(sql`ALTER TABLE vault_items ADD COLUMN IF NOT EXISTS always_ask BOOLEAN NOT NULL DEFAULT FALSE`);
  await db.execute(sql`ALTER TABLE skill_sets ADD COLUMN IF NOT EXISTS login_vault_item_id INTEGER`);
  // Capture full recording: steps to replay.
  await db.execute(sql`ALTER TABLE skill_sets ADD COLUMN IF NOT EXISTS recording JSONB`);
  logger.info("ensureWorkTables: meeting briefs and suggestions ready");
}
