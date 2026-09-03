import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * design-spec.md §16 Integrations — directory metadata only. Connection
 * *status* is never stored here: routes/integrations.ts joins this
 * table against the existing live isConnected() check (lib/oauthTokens.ts)
 * at read time, so there is exactly one source of truth for "is this
 * connected" (the oauth_tokens table) rather than two that could drift.
 * `id` deliberately matches the existing connector ids used in
 * routes/connectors.ts's ALL_CONNECTORS (e.g. "gmail", "github") so the
 * two can be joined/reasoned about together without a separate mapping.
 */
export const integrationDirectoryTable = pgTable("integration_directory", {
  id:          text("id").primaryKey(),
  name:        text("name").notNull(),
  dataScope:   text("data_scope").notNull(),   // plain language: what it can read
  actionScope: text("action_scope").notNull(), // plain language: what it can do
  reversible:  boolean("reversible").notNull().default(true),
  sourceType:  text("source_type").notNull().default("directory"), // 'directory' | 'openapi' | 'mcp' | 'manifest'
  sourceUrl:       text("source_url"),
  sourceAuthor:    text("source_author"),
  providerId:      text("provider_id"), // oauth_tokens.provider, when OAuth-backed
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIntegrationDirectorySchema = createInsertSchema(integrationDirectoryTable).omit({ createdAt: true });
export type InsertIntegrationDirectory = z.infer<typeof insertIntegrationDirectorySchema>;
export type IntegrationDirectoryEntry = typeof integrationDirectoryTable.$inferSelect;
