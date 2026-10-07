import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One row per (userId, provider) - hosted/managed mode Phase 2
 * (khameleon-decisions-log.md, 2026-10-03). `userId` is null for a
 * no-accounts/Option-A instance's one global connection - the historical
 * "one row per provider, single-user system" shape, unchanged. Once
 * accounts exist, each user connects their own Gmail/Outlook/Spotify,
 * fixing what was the single hardest blocker to real per-account
 * isolation (two people could not previously have two different
 * connected Google accounts at all).
 *
 * `provider` is no longer globally unique by itself - uniqueness is now
 * (userId, provider), enforced at the application layer in
 * oauthTokens.ts rather than a DB constraint, since Postgres unique
 * indexes don't treat two NULL userIds as colliding (which is exactly
 * the behavior the no-accounts case needs: still only one real
 * "global" row per provider).
 *
 * Gmail and Google Calendar share a single "google" row per user — scopes distinguish access.
 */
export const oauthTokensTable = pgTable("oauth_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"), // null = Option A / no-accounts global connection; set = this account's own connection (Option B)
  provider: text("provider").notNull(), // e.g. "google", "github", "slack"
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"), // null for providers that don't issue refresh tokens
  expiresAt: timestamp("expires_at", { withTimezone: true }), // null = never expires
  scope: text("scope").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertOauthTokenSchema = createInsertSchema(oauthTokensTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertOauthToken = z.infer<typeof insertOauthTokenSchema>;
export type OauthToken = typeof oauthTokensTable.$inferSelect;
