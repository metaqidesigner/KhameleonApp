import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const operatingModesTable = pgTable("operating_modes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  color: text("color").notNull().default("cyan"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOperatingModeSchema = createInsertSchema(operatingModesTable).omit({ id: true, createdAt: true });
export type InsertOperatingMode = z.infer<typeof insertOperatingModeSchema>;
export type OperatingMode = typeof operatingModesTable.$inferSelect;
