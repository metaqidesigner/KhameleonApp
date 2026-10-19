/**
 * Build 5: creates the procedure tables (and the skill's document link) if
 * they don't exist - idempotent, safe on every boot, same pattern as
 * ensure-settings-table.ts. Matches lib/db/src/schema/procedures.ts.
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./lib/logger.js";

export async function ensureProcedureTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS procedure_documents (
      id SERIAL PRIMARY KEY,
      work_domain_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      file_name TEXT NOT NULL DEFAULT '',
      text TEXT NOT NULL DEFAULT '',
      sections JSONB NOT NULL DEFAULT '[]',
      confidential BOOLEAN NOT NULL DEFAULT FALSE,
      content_hash TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS procedure_checks (
      id SERIAL PRIMARY KEY,
      skill_set_id INTEGER NOT NULL UNIQUE,
      document_id INTEGER,
      section_id TEXT,
      status TEXT NOT NULL,
      first_difference INTEGER,
      result JSONB NOT NULL DEFAULT '{}',
      less_certain BOOLEAN NOT NULL DEFAULT FALSE,
      needs_review BOOLEAN NOT NULL DEFAULT FALSE,
      checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`ALTER TABLE skill_sets ADD COLUMN IF NOT EXISTS source_document_id INTEGER`);
  await db.execute(sql`ALTER TABLE skill_sets ADD COLUMN IF NOT EXISTS source_section_id TEXT`);
  logger.info("ensureProcedureTables: procedure tables ready");
}
