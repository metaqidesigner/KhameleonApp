// Real, single-server encrypted secret storage — `encryptedValue` holds the
// actual secret (AES-256-GCM ciphertext via api-server's lib/crypto.ts, the
// same primitive already used for API keys/OAuth tokens since 2026-08-27).
// Never returned by any list/get response — only the dedicated reveal route
// in routes/vault.ts decrypts and returns it, and every reveal is logged to
// vault_access_log.ts.
//
// Still honestly future work, not built here (same framing as crypto.ts's
// own docblock):
// - HSM support
// - Zero-trust, per-request re-authentication
// - External secrets-manager integration (HashiCorp Vault, AWS Secrets Manager)
// Those need real infrastructure/product decisions, not just more code.

import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vaultItemsTable = pgTable("vault_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  permissionLevel: text("permission_level").notNull().default("read"),
  lastAccessed: text("last_accessed").notNull().default(""),
  owner: text("owner").notNull().default(""),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("active"),
  encryptedValue: text("encrypted_value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVaultItemSchema = createInsertSchema(vaultItemsTable).omit({ id: true, createdAt: true });
export type InsertVaultItem = z.infer<typeof insertVaultItemSchema>;
export type VaultItem = typeof vaultItemsTable.$inferSelect;
