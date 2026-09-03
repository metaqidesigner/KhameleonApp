import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * design-spec.md §15 Skill Sets — a bundle of instructions, reference
 * material, and optionally tools/scripts that teaches an agent how to
 * handle a specific class of task. `status` drives the confirm-gate
 * tiering in §15.3: 'available' rows are catalog entries nobody has
 * installed; 'pending' means a hard gate (an `approvals` row, see
 * approvals.ts) is waiting on the user for a scope-affecting or
 * externally-sourced install/update; 'installed'/'uninstalled' are the
 * settled states. requestedTools/requestedIntegrationIds are the exact
 * scope shown at the gate per §15.3/§15.5 - never a summary.
 */
export const skillSetsTable = pgTable("skill_sets", {
  id:                       serial("id").primaryKey(),
  name:                     text("name").notNull(),
  description:              text("description").notNull().default(""),
  content:                  text("content").notNull().default(""),
  sourceType:               text("source_type").notNull().default("authored"), // 'authored' | 'github' | 'url' | 'marketplace'
  sourceUrl:                text("source_url"),
  sourceAuthor:             text("source_author"),
  sourceUpdatedAt:          text("source_updated_at"),
  requestedTools:           jsonb("requested_tools").notNull().default("[]"),
  requestedIntegrationIds:  jsonb("requested_integration_ids").notNull().default("[]"),
  version:                  text("version").notNull().default("1.0.0"),
  status:                   text("status").notNull().default("available"), // 'available' | 'pending' | 'installed' | 'uninstalled'
  installedAt:              timestamp("installed_at", { withTimezone: true }),
  createdAt:                timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSkillSetSchema = createInsertSchema(skillSetsTable).omit({ id: true, createdAt: true, installedAt: true, status: true });
export type InsertSkillSet = z.infer<typeof insertSkillSetSchema>;
export type SkillSet = typeof skillSetsTable.$inferSelect;
