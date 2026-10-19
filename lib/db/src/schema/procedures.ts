import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

/**
 * Build 5 (docs/build-review.md): company procedure documents held in a
 * Work Domain, and the result of checking each skill against them.
 * Tables are created at server start (artifacts/api-server/src/
 * ensure-procedure-tables.ts) as well as by drizzle-kit push.
 */
export interface ProcedureSection { id: string; heading: string; text: string }

export const procedureDocumentsTable = pgTable("procedure_documents", {
  id:           serial("id").primaryKey(),
  workDomainId: integer("work_domain_id").notNull(),
  name:         text("name").notNull(),
  fileName:     text("file_name").notNull().default(""),
  text:         text("text").notNull().default(""),
  sections:     jsonb("sections").$type<ProcedureSection[]>().notNull().default([]),
  /** Compared and used only by Khami on this computer. */
  confidential: boolean("confidential").notNull().default(false),
  contentHash:  text("content_hash").notNull().default(""),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ProcedureDocument = typeof procedureDocumentsTable.$inferSelect;

export const procedureChecksTable = pgTable("procedure_checks", {
  id:              serial("id").primaryKey(),
  skillSetId:      integer("skill_set_id").notNull().unique(),
  documentId:      integer("document_id"),
  sectionId:       text("section_id"),
  status:          text("status").notNull(), // 'matches' | 'differs' | 'no_procedure'
  firstDifference: integer("first_difference"),
  result:          jsonb("result").notNull().default({}),
  lessCertain:     boolean("less_certain").notNull().default(false),
  /** Set when the procedure document changed after this check. */
  needsReview:     boolean("needs_review").notNull().default(false),
  checkedAt:       timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});
export type ProcedureCheck = typeof procedureChecksTable.$inferSelect;
