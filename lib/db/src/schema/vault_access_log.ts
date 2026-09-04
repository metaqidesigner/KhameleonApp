// Real audit trail for vault.ts — "audit trail for every access" from
// vault.ts's own TODO, scoped to what a single-server app can actually
// deliver (see vault.ts's docblock for what's still out of scope).
//
// Deliberately NOT a foreign key with cascade delete: `vaultItemId` is a
// plain integer and `itemName` is copied at write time, so this log
// outlives the item it's about. A vault's whole point is that "this secret
// was deleted on <date>" has to remain readable after the delete — a
// cascading FK would silently erase the one record that matters most.
// Don't "fix" this into a real FK without re-reading this comment.

import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vaultAccessLogTable = pgTable("vault_access_log", {
  id: serial("id").primaryKey(),
  vaultItemId: integer("vault_item_id").notNull(),
  itemName: text("item_name").notNull(),
  action: text("action").notNull(), // 'created' | 'viewed' | 'updated' | 'deleted'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVaultAccessLogSchema = createInsertSchema(vaultAccessLogTable).omit({ id: true, createdAt: true });
export type InsertVaultAccessLog = z.infer<typeof insertVaultAccessLogSchema>;
export type VaultAccessLog = typeof vaultAccessLogTable.$inferSelect;
