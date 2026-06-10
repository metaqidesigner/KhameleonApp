// TODO: Future implementation:
// - End-to-end encryption with HSM support
// - Zero trust architecture
// - Secrets management integration (HashiCorp Vault, AWS Secrets Manager)
// - Hardware security key support
// This table stores MOCK data only — no real credentials should ever be stored here.

import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vaultItemsTable = pgTable("vault_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  permissionLevel: text("permission_level").notNull().default("read"),
  lastAccessed: text("last_accessed").notNull().default(""),
  owner: text("owner").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVaultItemSchema = createInsertSchema(vaultItemsTable).omit({ id: true, createdAt: true });
export type InsertVaultItem = z.infer<typeof insertVaultItemSchema>;
export type VaultItem = typeof vaultItemsTable.$inferSelect;
