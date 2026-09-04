import { pgTable, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export interface TaskStep {
  index: number;
  label: string;
  /** 'pending' | 'running' | 'done' | 'failed' */
  status: string;
  output?: string;
  startedAt?: string;
  completedAt?: string;
}

export const taskRunsTable = pgTable(
  "task_runs",
  {
    id:            uuid("id").primaryKey().defaultRandom(),
    commandText:   text("command_text").notNull(),
    /** 'manual' | 'scheduled' | 'event' */
    triggerType:   text("trigger_type").notNull().default("manual"),
    /** schedule name, event description, etc. */
    triggerSource: text("trigger_source"),
    agentId:       text("agent_id").notNull().default("claude"),
    /**
     * design-spec.md §11.1's execution-model contract: which path ran
     * this task, not which persona (that's agentId). 'orchestrator' is
     * today's existing multi-step plan-then-execute path; 'simple' is
     * a single-shot, single-step path added for §11.1's `simple` agent
     * type (no tool calls needed, skips the separate planning call
     * entirely). 'traced' and 'sandboxed' are reserved per §11.1/§11.6
     * but not built yet.
     */
    agentType:     text("agent_type").notNull().default("orchestrator"),
    /** 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' */
    status:        text("status").notNull().default("queued"),
    /** JSON array of TaskStep */
    steps:         jsonb("steps").notNull().default("[]"),
    /** Live accumulating work product */
    previewContent: text("preview_content"),
    /** One-line result shown in collapsed card */
    resultSummary:  text("result_summary"),
    errorMessage:   text("error_message"),
    retryCount:     integer("retry_count").notNull().default(0),
    /** Which step to restart from on retry */
    retryFromStep:  integer("retry_from_step"),
    createdAt:     timestamp("created_at",   { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     timestamp("updated_at",   { withTimezone: true }).notNull().defaultNow(),
    completedAt:   timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("tr_status_idx").on(t.status, t.createdAt),
    index("tr_trigger_idx").on(t.triggerType, t.createdAt),
    index("tr_created_at_idx").on(t.createdAt),
  ]
);

export const insertTaskRunSchema = createInsertSchema(taskRunsTable).omit({
  id: true, createdAt: true, updatedAt: true, completedAt: true,
});
export type InsertTaskRun = z.infer<typeof insertTaskRunSchema>;
export type TaskRun = typeof taskRunsTable.$inferSelect;
