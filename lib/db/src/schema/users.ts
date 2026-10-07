// Real user accounts (hosted/managed mode "Option B" — see
// khameleon-decisions-log.md, 2026-10-01/2026-10-03). Deliberately a new,
// separate table rather than extending the shared-password Option A
// (lib/session.ts's single global in-memory session) — that mechanism has
// no identity concept to extend, and keeps working unchanged for any
// instance that doesn't create a users row.
//
// No real FK columns elsewhere in this schema reference this table yet
// (per the 2026-10-03 audit: all 25 existing tables are global/single-user)
// - the three tables that do gain a userId column this phase (oauth_tokens,
// vault_items, vault_access_log) follow this schema's existing convention
// of plain integer columns, not enforced FKs (see vault_access_log.ts's own
// docblock for why - outliving deletes matters more here than referential
// integrity a single-process app can't meaningfully enforce anyway).

import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  /** scrypt("<password>", <random per-user salt>) - see api-server/src/lib/accounts.ts. Never the raw password. */
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull().default(""),
  role: text("role").notNull().default(""),
  /** The first account ever created on an instance - see accounts.ts's createUser(). Not a role system, just "who manages other accounts." */
  isAdmin: boolean("is_admin").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

/** Safe to send to the client - never includes passwordHash. */
export type PublicUser = Omit<User, "passwordHash">;
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}
