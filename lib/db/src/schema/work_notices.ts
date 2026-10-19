import { pgTable, serial, text, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Builds 10-11: meeting briefs (one per meeting, generated once and topped
 * up with new emails) and the suggestion slot's items (meeting briefs,
 * urgent mail). Created at server start by
 * artifacts/api-server/src/ensure-work-tables.ts as well as drizzle-kit push.
 */
export const meetingBriefsTable = pgTable("meeting_briefs", {
  id:          serial("id").primaryKey(),
  eventId:     text("event_id").notNull().unique(),
  title:       text("title").notNull(),
  startsAt:    timestamp("starts_at", { withTimezone: true }).notNull(),
  attendees:   jsonb("attendees").$type<{ name: string; email: string }[]>().notNull().default([]),
  brief:       text("brief").notNull(),
  emailIds:    jsonb("email_ids").$type<string[]>().notNull().default([]),
  suggestedAt: timestamp("suggested_at", { withTimezone: true }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
});
export type MeetingBrief = typeof meetingBriefsTable.$inferSelect;

export const suggestionsTable = pgTable("suggestions", {
  id:          serial("id").primaryKey(),
  kind:        text("kind").notNull(), // 'meeting_brief' | 'urgent_mail'
  title:       text("title").notNull(),
  body:        text("body").notNull().default(""),
  why:         text("why").notNull().default(""),
  ref:         jsonb("ref").notNull().default({}),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt:   timestamp("expires_at", { withTimezone: true }),
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
  openedAt:    timestamp("opened_at", { withTimezone: true }),
});
export type Suggestion = typeof suggestionsTable.$inferSelect;
