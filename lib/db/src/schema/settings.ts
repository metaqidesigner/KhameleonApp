import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Generic key-value settings store.
 * Used for persisting lightweight server-side config such as scheduler settings.
 */
export const settingsTable = pgTable("settings", {
  key:       text("key").primaryKey(),
  value:     text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Setting = typeof settingsTable.$inferSelect;
