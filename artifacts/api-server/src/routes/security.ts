import { Router } from "express";
import { db } from "@workspace/db";
import { securityEventsTable, securityLayersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/status", async (req, res) => {
  try {
    const layers = await db.select().from(securityLayersTable).orderBy(securityLayersTable.id);
    const events = await db.select().from(securityEventsTable);
    const activeThreats = events.filter((e) => !e.resolved && e.severity !== "low").length;
    const vulns = events.filter((e) => !e.resolved).length;
    const avgScore = layers.length > 0 ? Math.round(layers.reduce((s, l) => s + l.score, 0) / layers.length) : 95;

    res.json({
      overallScore: avgScore,
      threatLevel: activeThreats === 0 ? "low" : activeThreats < 3 ? "medium" : "high",
      activeThreats,
      vulnerabilities: vulns,
      complianceStatus: "compliant",
      vaultStatus: "locked",
      layers,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching security status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/events", async (req, res) => {
  try {
    const events = await db.select().from(securityEventsTable).orderBy(securityEventsTable.createdAt);
    res.json(events.reverse());
  } catch (err) {
    req.log.error({ err }, "Error fetching security events");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
