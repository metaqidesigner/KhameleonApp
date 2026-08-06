import { pgTable, serial, text, integer, doublePrecision, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentConversationsTable = pgTable(
  "agent_conversations",
  {
    id:        serial("id").primaryKey(),
    agentId:   text("agent_id").notNull(),
    sessionId: text("session_id").notNull(),
    /** 'user' | 'assistant' | 'tool_use' | 'tool_result' */
    role:      text("role").notNull(),
    content:   text("content").notNull(),
    /** populated for tool_use / tool_result rows */
    toolName:  text("tool_name"),
    /** populated for assistant rows only */
    latencyMs: integer("latency_ms"),
    tokens:    integer("tokens"),
    costUsd:   doublePrecision("cost_usd"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ac_agent_session_idx").on(table.agentId, table.sessionId, table.createdAt),
    index("ac_created_at_idx").on(table.createdAt),
  ]
);

export const insertAgentConversationSchema = createInsertSchema(agentConversationsTable).omit({
  id: true, createdAt: true,
});
export type InsertAgentConversation = z.infer<typeof insertAgentConversationSchema>;
export type AgentConversation = typeof agentConversationsTable.$inferSelect;
