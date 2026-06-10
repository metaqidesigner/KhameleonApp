import { pgTable, text, serial, boolean, integer, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const automationsTable = pgTable("automations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  trigger: text("trigger").notNull(),
  status: text("status").notNull().default("active"),
  applicationsUsed: text("applications_used").array().notNull().default([]),
  requiredPermissions: text("required_permissions").array().notNull().default([]),
  requiresApproval: boolean("requires_approval").notNull().default(false),
  lastExecution: text("last_execution").notNull().default(""),
  timeSaved: real("time_saved").notNull().default(0),
  runsCount: integer("runs_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAutomationSchema = createInsertSchema(automationsTable).omit({ id: true, createdAt: true });
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automationsTable.$inferSelect;
