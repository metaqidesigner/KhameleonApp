import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const communicationsTable = pgTable("communications", {
  id: serial("id").primaryKey(),
  sender: text("sender").notNull(),
  senderEmail: text("sender_email").notNull().default(""),
  subject: text("subject").notNull(),
  source: text("source").notNull().default("email"),
  summary: text("summary").notNull(),
  sentiment: text("sentiment").notNull().default("neutral"),
  priority: text("priority").notNull().default("medium"),
  suggestedResponse: text("suggested_response").notNull().default(""),
  relatedProject: text("related_project").notNull().default(""),
  requiredActions: text("required_actions").array().notNull().default([]),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommunicationSchema = createInsertSchema(communicationsTable).omit({ id: true, createdAt: true });
export type InsertCommunication = z.infer<typeof insertCommunicationSchema>;
export type Communication = typeof communicationsTable.$inferSelect;
