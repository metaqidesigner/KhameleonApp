// design-spec.md §15.2 - contextual surfacing: "when a task in progress
// matches a not-yet-installed Skill Set closely, the system may surface it
// inline as a suggestion... A dismissed suggestion does not repeat for the
// same task thread."
//
// One row per computed match, written once (see routes/tasks.ts's POST /,
// which fires the match asynchronously right after a task is created).
// No row at all is a valid, honest state too - it means either "checked,
// no close match" or "not yet checked" - both correctly render as no
// suggestion on the frontend.
//
// `taskId` is a plain integer, no FK - consistent with
// entityWorkDomainsTable's existing convention in this schema.

import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskSkillSetSuggestionsTable = pgTable("task_skill_set_suggestions", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  skillSetId: integer("skill_set_id").notNull(),
  reason: text("reason").notNull(),
  dismissed: boolean("dismissed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskSkillSetSuggestionSchema = createInsertSchema(taskSkillSetSuggestionsTable).omit({ id: true, createdAt: true });
export type InsertTaskSkillSetSuggestion = z.infer<typeof insertTaskSkillSetSuggestionSchema>;
export type TaskSkillSetSuggestion = typeof taskSkillSetSuggestionsTable.$inferSelect;
