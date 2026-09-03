import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * design-spec.md §17 Work Domains — a free-form, user-owned label for
 * organizing Skill Sets and Integrations around the shape of a job.
 * No fixed taxonomy: `isBuiltIn` marks the illustrative starter set
 * (seeded once, see seed.ts) so the UI can distinguish "ships with
 * Khameleon" from user-created, but a built-in domain is otherwise a
 * completely ordinary row a user may rename or delete freely.
 */
export const workDomainsTable = pgTable("work_domains", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description").notNull().default(""),
  isBuiltIn:   boolean("is_built_in").notNull().default(false),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkDomainSchema = createInsertSchema(workDomainsTable).omit({ id: true, createdAt: true });
export type InsertWorkDomain = z.infer<typeof insertWorkDomainSchema>;
export type WorkDomain = typeof workDomainsTable.$inferSelect;

/**
 * One shared join table for both taggable entity types (§17.2: a Skill
 * Set or Integration may carry zero, one, or multiple Work Domain tags)
 * instead of two near-identical per-type join tables. `entityId` is text
 * because integrations use their existing string connector ids (e.g.
 * "gmail") while skill sets use a serial int id stringified - kept
 * loose deliberately so this table doesn't need a real FK per type.
 */
export const entityWorkDomainsTable = pgTable("entity_work_domains", {
  id:           serial("id").primaryKey(),
  entityType:   text("entity_type").notNull(), // 'skill_set' | 'integration'
  entityId:     text("entity_id").notNull(),
  workDomainId: integer("work_domain_id").notNull(),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEntityWorkDomainSchema = createInsertSchema(entityWorkDomainsTable).omit({ id: true, createdAt: true });
export type InsertEntityWorkDomain = z.infer<typeof insertEntityWorkDomainSchema>;
export type EntityWorkDomain = typeof entityWorkDomainsTable.$inferSelect;
