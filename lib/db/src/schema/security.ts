import { pgTable, text, serial, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const securityEventsTable = pgTable("security_events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  severity: text("severity").notNull().default("low"),
  description: text("description").notNull(),
  timestamp: text("timestamp").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const securityLayersTable = pgTable("security_layers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("secure"),
  score: integer("score").notNull().default(100),
  lastScan: text("last_scan").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSecurityEventSchema = createInsertSchema(securityEventsTable).omit({ id: true, createdAt: true });
export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;
export type SecurityEvent = typeof securityEventsTable.$inferSelect;

export const insertSecurityLayerSchema = createInsertSchema(securityLayersTable).omit({ id: true, createdAt: true });
export type InsertSecurityLayer = z.infer<typeof insertSecurityLayerSchema>;
export type SecurityLayer = typeof securityLayersTable.$inferSelect;
