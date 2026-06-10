import { pgTable, text, serial, integer, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const researchItemsTable = pgTable("research_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  type: text("type").notNull().default("article"),
  status: text("status").notNull().default("active"),
  tags: text("tags").array().notNull().default([]),
  sources: integer("sources").notNull().default(0),
  credibilityScore: real("credibility_score").notNull().default(0),
  aiSummary: text("ai_summary").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertResearchItemSchema = createInsertSchema(researchItemsTable).omit({ id: true, createdAt: true });
export type InsertResearchItem = z.infer<typeof insertResearchItemSchema>;
export type ResearchItem = typeof researchItemsTable.$inferSelect;
