// design-spec.md §16.6 — "Defined by the user pointing Khameleon at an
// external service definition — an OpenAPI spec, an MCP server URL... "
// integration_directory.ts already anticipated this (sourceType 'openapi'
// | 'mcp' has existed there since before this table), but nothing ever
// parsed a spec or turned it into real callable tools. This table holds
// the real, user-imported definitions that actually do that.
//
// operations (openapi only): JSON-serialized ParsedOperation[] (see
// lib/openApiImport.ts) - cached at import time rather than re-parsed on
// every agent turn, matching the real tool-discovery flow in
// agents/tools/customIntegrations.ts.
//
// encryptedAuthToken: AES-256-GCM via lib/crypto.ts, same primitive as
// every other stored credential in this app (API keys, OAuth tokens,
// Vault secrets) - optional, since a public API/MCP server needs none.

import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customIntegrationsTable = pgTable("custom_integrations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  /** 'openapi' | 'mcp' */
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  /** openapi only - the server base URL real tool calls are made against. */
  baseUrl: text("base_url"),
  /** openapi only - JSON-serialized ParsedOperation[]. */
  operations: text("operations"),
  encryptedAuthToken: text("encrypted_auth_token"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCustomIntegrationSchema = createInsertSchema(customIntegrationsTable).omit({
  id: true, createdAt: true,
});
export type InsertCustomIntegration = z.infer<typeof insertCustomIntegrationSchema>;
export type CustomIntegration = typeof customIntegrationsTable.$inferSelect;
