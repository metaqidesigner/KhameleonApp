import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One row per OAuth provider (single-user system).
 * Gmail and Google Calendar share a single "google" row — scopes distinguish access.
 */
export const oauthTokensTable = pgTable("oauth_tokens", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().unique(), // e.g. "google", "github", "slack"
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
