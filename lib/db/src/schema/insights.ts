import { pgTable, text, serial, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const insightsTable = pgTable("insights", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  category: text("category").notNull(),
  confidenceScore: real("confidence_score").notNull().default(0.8),
  priority: text("priority").notNull().default("medium"),
  actionRequired: boolean("action_required").notNull().default(false),
  relatedProject: text("related_project").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInsightSchema = createInsertSchema(insightsTable).omit({ id: true, createdAt: true });
export type InsertInsight = z.infer<typeof insertInsightSchema>;
export type Insight = typeof insightsTable.$inferSelect;
