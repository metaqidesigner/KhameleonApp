import { Router } from "express";
import { db } from "@workspace/db";
import { communicationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const comms = await db.select().from(communicationsTable).orderBy(communicationsTable.createdAt);
    res.json(comms.reverse());
  } catch (err) {
    req.log.error({ err }, "Error fetching communications");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics", async (_req, res) => {
  const comms = await db.select().from(communicationsTable);
  const total = comms.length;

  const bySentiment = [
    { name: "Positive", value: comms.filter((c) => c.sentiment === "positive").length, color: "#10b981" },
    { name: "Neutral", value: comms.filter((c) => c.sentiment === "neutral").length, color: "#6b7280" },
    { name: "Urgent", value: comms.filter((c) => c.sentiment === "urgent").length, color: "#ef4444" },
    { name: "Negative", value: comms.filter((c) => c.sentiment === "negative").length, color: "#f59e0b" },
  ].filter((s) => s.value > 0);

  const sourceMap = new Map<string, number>();
  for (const c of comms) {
    sourceMap.set(c.source, (sourceMap.get(c.source) ?? 0) + 1);
  }

  const sourceColors: Record<string, string> = {
    email: "#00d4ff",
    teams: "#6366f1",
    slack: "#c9a84c",
    calendar: "#10b981",
  };

  const bySource = Array.from(sourceMap.entries()).map(([name, value]) => ({
    name,
    value,
    color: sourceColors[name.toLowerCase()] ?? "#6b7280",
  }));

  res.json({
    totalMessages: total,
    responseRate: 0.87,
    avgResponseTime: 2.4,
    bySource,
    bySentiment,
  });
});

export default router;
