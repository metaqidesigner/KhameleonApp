import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getAllMetrics } from "../agents/store.js";
import { getRoster } from "../agents/defaults.js";

const router: IRouter = Router();

const startTime = Date.now();

function buildHealthPayload() {
  const metrics = getAllMetrics();
  const totalQueries = metrics.reduce((s, m) => s + m.queries, 0);
  const totalCostUsd = metrics.reduce((s, m) => s + m.totalCostUsd, 0);
  const totalEnergyWh = metrics.reduce((s, m) => s + m.totalEnergyWh, 0);
  const avgLatencyMs =
    totalQueries > 0
      ? Math.round(metrics.reduce((s, m) => s + m.avgLatencyMs * m.queries, 0) / totalQueries)
      : 0;

  // Real configuration, not a fixed label (gap review Q2): the providers
  // and models of the agents that are switched on.
  const enabled = getRoster().filter((a) => a.enabled);
  const unique = (xs: string[]) => [...new Set(xs)].join(" / ") || "none";

  return {
    status: "online" as const,
    engine: unique(enabled.map((a) => a.provider)),
    model: unique(enabled.map((a) => a.model)),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    total_queries: totalQueries,
    total_cost_usd: totalCostUsd,
    avg_latency_ms: avgLatencyMs,
    tokens_per_sec: 0,
    watt_per_query: totalQueries > 0 ? totalEnergyWh / totalQueries : 0,
  };
}

// /api/health — primary endpoint the frontend polls
router.get("/health", (_req, res) => {
  res.json(buildHealthPayload());
});

// /api/healthz — legacy alias used by infra probes
router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
