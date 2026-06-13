import type { AgentMetrics, ConversationEntry } from './types.js';

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

export function recordQuery(
  agentId: string,
  latencyMs: number,
  tokens: number,
  costUsd: number,
  energyWh: number,
  userMessage: string,
  assistantMessage: string,
  model: string,
): void {
  const acc = metricsMap.get(agentId) ?? {
    queries: 0, totalLatencyMs: 0, totalTokens: 0,
    totalCostUsd: 0, totalEnergyWh: 0, lastActive: '',
  };
  acc.queries += 1;
  acc.totalLatencyMs += latencyMs;
  acc.totalTokens += tokens;
  acc.totalCostUsd += costUsd;
  acc.totalEnergyWh += energyWh;
  acc.lastActive = new Date().toISOString();
  metricsMap.set(agentId, acc);

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
  });
  historyMap.set(agentId, history.slice(0, 50));
}

export function getMetrics(agentId: string): AgentMetrics {
  const acc = metricsMap.get(agentId);
  if (!acc || acc.queries === 0) {
    return {
      agentId, queries: 0, avgLatencyMs: 0, avgTokens: 0,
      totalCostUsd: 0, totalEnergyWh: 0, qualityScore: 0,
    };
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
