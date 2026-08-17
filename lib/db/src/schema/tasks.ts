import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id:               serial("id").primaryKey(),
  title:            text("title").notNull(),
  description:      text("description").notNull().default(""),
  status:           text("status").notNull().default("todo"),        // todo | in_progress | done | blocked
  priority:         text("priority").notNull().default("medium"),    // urgent | high | medium | low
  // ── Task taxonomy ─────────────────────────────────────────────────
  category:         text("category").notNull().default("deep_work"), // communication | meetings | deep_work | task_project_management | administrative | planning
  recurrence:       text("recurrence").notNull().default("one_off"), // one_off | daily | weekly | custom
  source:           text("source").notNull().default("manual"),      // manual | agent
  // ── Optional links ────────────────────────────────────────────────
  calendarEventId:  text("calendar_event_id"),
  threadId:         text("thread_id"),
  parentTaskId:     integer("parent_task_id"),
  // ── Existing ──────────────────────────────────────────────────────
  projectId:        integer("project_id"),
  assignee:         text("assignee").notNull().default(""),
  dueDate:          text("due_date"),
  aiRecommendation: text("ai_recommendation").notNull().default(""),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
