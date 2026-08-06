import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { agentConversationsTable } from "@workspace/db";
import type { AgentMetrics, ConversationEntry, ToolCallRecord } from "./types.js";
import { logger } from "../lib/logger.js";

// ── In-memory store (fast reads, backwards compat) ────────────
interface MetricsAccumulator {
  queries: number;
  totalLatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  totalEnergyWh: number;
  lastActive: string;
}

const metricsMap = new Map<string, MetricsAccumulator>();
const historyMap = new Map<string, ConversationEntry[]>();

// ── DB persistence (fire-and-forget) ─────────────────────────
async function persistConversation(
  agentId: string,
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  latencyMs: number,
  tokens: number,
  costUsd: number,
  toolCalls?: ToolCallRecord[],
): Promise<void> {
  // User turn
  await db.insert(agentConversationsTable).values({
    agentId,
    sessionId,
    role: "user",
    content: userMessage,
  });

  // Tool calls (one pair of rows per tool call)
  for (const tc of toolCalls ?? []) {
    await db.insert(agentConversationsTable).values({
      agentId,
      sessionId,
      role: "tool_use",
      content: JSON.stringify(tc.input),
      toolName: tc.name,
    });
    await db.insert(agentConversationsTable).values({
      agentId,
      sessionId,
      role: "tool_result",
      content: tc.error ? `[ERROR] ${tc.error}` : tc.result.slice(0, 4000),
      toolName: tc.name,
    });
  }

  // Assistant turn
  await db.insert(agentConversationsTable).values({
    agentId,
    sessionId,
    role: "assistant",
    content: assistantMessage,
    latencyMs,
    tokens,
    costUsd,
  });
}

// ── Public API ────────────────────────────────────────────────

export function recordQuery(
  agentId: string,
  latencyMs: number,
  tokens: number,
  costUsd: number,
  energyWh: number,
  userMessage: string,
  assistantMessage: string,
  model: string,
  sessionId?: string,
  toolCalls?: ToolCallRecord[],
): void {
  // --- In-memory metrics ---
  const acc = metricsMap.get(agentId) ?? {
    queries: 0, totalLatencyMs: 0, totalTokens: 0,
    totalCostUsd: 0, totalEnergyWh: 0, lastActive: "",
  };
  acc.queries += 1;
  acc.totalLatencyMs += latencyMs;
  acc.totalTokens += tokens;
  acc.totalCostUsd += costUsd;
  acc.totalEnergyWh += energyWh;
  acc.lastActive = new Date().toISOString();
  metricsMap.set(agentId, acc);

  // --- In-memory history (capped at 50) ---
  const history = historyMap.get(agentId) ?? [];
  history.unshift({
    id: `${agentId}-${Date.now()}`,
    agentId,
    userMessage,
    assistantMessage,
    model,
    ts: Date.now(),
    latencyMs,
    tokens,
    costUsd,
    toolCalls,
  });
  historyMap.set(agentId, history.slice(0, 50));

  // --- DB persistence (async, fire-and-forget) ---
  const sid = sessionId ?? randomUUID();
  persistConversation(agentId, sid, userMessage, assistantMessage, latencyMs, tokens, costUsd, toolCalls)
    .catch((err) => logger.error({ err, agentId, sid }, "Failed to persist conversation to DB"));
}

export function getMetrics(agentId: string): AgentMetrics {
  const acc = metricsMap.get(agentId);
  if (!acc || acc.queries === 0) {
    return { agentId, queries: 0, avgLatencyMs: 0, avgTokens: 0, totalCostUsd: 0, totalEnergyWh: 0, qualityScore: 0 };
  }
  return {
    agentId,
    queries: acc.queries,
    avgLatencyMs: Math.round(acc.totalLatencyMs / acc.queries),
    avgTokens: Math.round(acc.totalTokens / acc.queries),
    totalCostUsd: acc.totalCostUsd,
    totalEnergyWh: acc.totalEnergyWh,
    qualityScore: 0.85,
    lastActive: acc.lastActive,
  };
}

export function getHistory(agentId: string): ConversationEntry[] {
  return historyMap.get(agentId) ?? [];
}

export function getAllMetrics(): AgentMetrics[] {
  return [...metricsMap.keys()].map(getMetrics);
}
