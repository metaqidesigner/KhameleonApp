import { pgTable, text, serial, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// TODO: Future AI Marketplace implementation:
// - Agent installation and upgrade pipeline
// - Provider API integrations: OpenAI, Anthropic, Google, Meta, Mistral, open-source models
// - Agent performance benchmarking
// - Billing and cost tracking per agent
// - Agent sandboxing and permissions model

export const marketplaceAgentsTable = pgTable("marketplace_agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  provider: text("provider").notNull(),
  category: text("category").notNull(),
  accuracyScore: real("accuracy_score").notNull().default(0),
  costScore: real("cost_score").notNull().default(0),
  speedScore: real("speed_score").notNull().default(0),
  reliabilityScore: real("reliability_score").notNull().default(0),
  privacyScore: real("privacy_score").notNull().default(0),
  isInstalled: boolean("is_installed").notNull().default(false),
  version: text("version").notNull().default("1.0.0"),
  pricing: text("pricing").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMarketplaceAgentSchema = createInsertSchema(marketplaceAgentsTable).omit({ id: true, createdAt: true });
export type InsertMarketplaceAgent = z.infer<typeof insertMarketplaceAgentSchema>;
export type MarketplaceAgent = typeof marketplaceAgentsTable.$inferSelect;
