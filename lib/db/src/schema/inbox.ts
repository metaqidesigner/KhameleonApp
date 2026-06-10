import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const inboxItemsTable = pgTable("inbox_items", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  sourceIcon: text("source_icon").notNull().default(""),
  sender: text("sender").notNull().default(""),
  subject: text("subject").notNull(),
  summary: text("summary").notNull(),
  priority: text("priority").notNull().default("medium"),
  classification: text("classification").notNull().default("task"),
  aiRecommendation: text("ai_recommendation").notNull().default(""),
  relatedProject: text("related_project").notNull().default(""),
  priorityScore: integer("priority_score").notNull().default(50),
  isRead: boolean("is_read").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInboxItemSchema = createInsertSchema(inboxItemsTable).omit({ id: true, createdAt: true });
export type InsertInboxItem = z.infer<typeof insertInboxItemSchema>;
export type InboxItem = typeof inboxItemsTable.$inferSelect;
