import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const memoryItemsTable = pgTable("memory_items", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  isProtected: boolean("is_protected").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMemoryItemSchema = createInsertSchema(memoryItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMemoryItem = z.infer<typeof insertMemoryItemSchema>;
export type MemoryItem = typeof memoryItemsTable.$inferSelect;
