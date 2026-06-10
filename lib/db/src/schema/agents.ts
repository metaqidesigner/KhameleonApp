import { pgTable, text, serial, integer, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentsTable = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  reliabilityScore: real("reliability_score").notNull().default(0),
  costScore: real("cost_score").notNull().default(0),
  status: text("status").notNull().default("active"),
  supportedModels: text("supported_models").array().notNull().default([]),
  strengths: text("strengths").array().notNull().default([]),
  useCases: text("use_cases").array().notNull().default([]),
  permissions: text("permissions").array().notNull().default([]),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  avgResponseTime: real("avg_response_time").notNull().default(0),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({ id: true, createdAt: true });
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agentsTable.$inferSelect;
