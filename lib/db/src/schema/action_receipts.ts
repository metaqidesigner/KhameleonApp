import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * design-spec.md §6.5.2 Action receipts — a durable record of an
 * autonomous or local action, distinct from a transient toast. Mirrors
 * the shape of components/ActionReceipt.tsx's props exactly, since that
 * component (already built, used only against local demo state until
 * now) is the real consumer. `relatedApprovalId` links a receipt back
 * to the approvals-table row that gated it, when the action went
 * through a hard gate (approvals.ts) rather than being immediate/local.
 */
export const actionReceiptsTable = pgTable("action_receipts", {
  id:                serial("id").primaryKey(),
  description:       text("description").notNull(),
  category:          text("category").notNull(),
  scope:             text("scope").notNull(),
  outcome:           text("outcome").notNull().default("success"), // 'success' | 'failure' | 'pending' | 'needs_review'
  target:            text("target"),
  canUndo:           boolean("can_undo").notNull().default(false),
  undone:            boolean("undone").notNull().default(false),
  relatedApprovalId: integer("related_approval_id"),
  createdAt:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActionReceiptSchema = createInsertSchema(actionReceiptsTable).omit({ id: true, createdAt: true, undone: true });
export type InsertActionReceipt = z.infer<typeof insertActionReceiptSchema>;
export type ActionReceiptRow = typeof actionReceiptsTable.$inferSelect;
