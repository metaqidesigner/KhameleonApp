import { Router } from "express";
import { getAllMetrics, getHistory } from "../agents/store.js";

const router = Router();

router.get("/", (_req, res) => {
  const metrics = getAllMetrics();

  const totalQueries = metrics.reduce((s, m) => s + m.queries, 0);
  const totalCostUsd = metrics.reduce((s, m) => s + m.totalCostUsd, 0);
  const totalEnergyWh = metrics.reduce((s, m) => s + m.totalEnergyWh, 0);
  const avgLatencyMs =
    totalQueries > 0
      ? Math.round(
          metrics.reduce((s, m) => s + m.avgLatencyMs * m.queries, 0) /
            totalQueries,
        )
      : 0;

  // Build per-agent map for the frontend
  const byAgent: Record<
    string,
    {
      queries: number;
      avg_latency: number;
      avg_tokens: number;
      avg_cost: number;
      total_cost: number;
    }
  > = {};
  for (const m of metrics) {
    byAgent[m.agentId] = {
      queries: m.queries,
      avg_latency: m.avgLatencyMs,
      avg_tokens: m.avgTokens,
      avg_cost: m.queries > 0 ? m.totalCostUsd / m.queries : 0,
      total_cost: m.totalCostUsd,
    };
  }

  // Flatten recent queries across all agents (last 100)
  const allHistory = metrics
    .flatMap((m) => getHistory(m.agentId))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 100)
    .map((h) => ({
      ts: h.ts,
      agent: h.agentId,
      latency_ms: h.latencyMs,
      cost_usd: h.costUsd,
      energy_wh: h.costUsd * 0.003, // rough proxy if not tracked
    }));

  res.json({
    queries: allHistory,
    energy_wh: totalEnergyWh,
    cost_usd: totalCostUsd,
    avg_latency_ms: avgLatencyMs,
    by_agent: byAgent,
    total_queries: totalQueries,
    memory_chunks: 0,
  });
});

export default router;
