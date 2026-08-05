import { Router } from "express";
import { getAllMetrics, getHistory } from "../agents/store.js";

const router = Router();

router.get("/", (_req, res) => {
  const metrics = getAllMetrics();

  // Collect recent conversation history across all agents
  const feed = metrics
    .flatMap((m) => getHistory(m.agentId))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 50)
    .map((h) => ({
      id: h.id,
      ts: h.ts,
      agent: h.agentId,
      prompt: h.userMessage,
      latency_ms: h.latencyMs,
      tokens: h.tokens,
      cost_usd: h.costUsd,
    }));

  res.json(feed);
});

export default router;
