import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id:               serial("id").primaryKey(),
  title:            text("title").notNull(),
  description:      text("description").notNull().default(""),
  status:           text("status").notNull().default("todo"),        // todo | in_progress | done | blocked | needs_input
  priority:         text("priority").notNull().default("medium"),    // urgent | high | medium | low
  // ── Task taxonomy ─────────────────────────────────────────────────
  category:         text("category").notNull().default("deep_work"), // communication | meetings | deep_work | task_project_management | administrative | planning
  recurrence:       text("recurrence").notNull().default("one_off"), // one_off | daily | weekly | custom
  source:           text("source").notNull().default("manual"),      // manual | agent
  // ── Optional links ────────────────────────────────────────────────
  calendarEventId:  text("calendar_event_id"),
  threadId:         text("thread_id"),
  parentTaskId:     integer("parent_task_id"),
  // ── Parked-work reason (Live Wall left column, 2026-09-25) ─────────
  // Only meaningful when status = 'blocked'/'todo'; a task can be parked
  // for a reason distinct from generic "blocked" - which external thing
  // it's waiting on, whether the user deliberately paused it, or which
  // other task it depends on finishing first. "User unavailable/in a
  // meeting" was explicitly left out - no presence/calendar signal
  // exists anywhere in this codebase to back it honestly.
  parkedReason:     text("parked_reason"),         // external_input | deferred | dependency | null
  waitingOn:        text("waiting_on"),            // e.g. "tenant reply" - what/who it's waiting on
  waitingSince:     text("waiting_since"),          // ISO date string, same convention as dueDate below -
                                                     // a real `timestamp` column requires a JS Date object
                                                     // at the Drizzle driver layer, not the raw string an
                                                     // API body actually carries; dueDate already sidesteps
                                                     // that by being text, so this follows the same pattern
                                                     // instead of adding string<->Date marshalling nothing
                                                     // else in this table's API surface needs.
  blockedByTaskId:  integer("blocked_by_task_id"), // dependency reason: id of the task this is waiting on
  // ── Center column "current focus + queue" (2026-09-26) ─────────────
  // Real fields, same as parkedReason above: nothing in the task-execution
  // pipeline writes these automatically yet (task-executor.ts's
  // taskRunsTable is a separate multi-step command-trace concept, not
  // linked to this table) - they're genuinely real and queryable, just not
  // yet auto-populated by a deeper pipeline. executingAgentId/zdrEndpoint
  // are set directly (e.g. by whatever creates/updates the task), the same
  // way parkedReason is today.
  executingAgentId: text("executing_agent_id"),    // AgentConfig.id of whichever agent is/was working this
  zdrEndpoint:      boolean("zdr_endpoint"),        // true if this task's execution used a zero-retention endpoint
  queuePosition:    integer("queue_position"),      // user-directed queue order (drag-to-reorder); null = unordered
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
