import { Router } from "express";
import { db } from "@workspace/db";
import { automationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const automations = await db.select().from(automationsTable).orderBy(automationsTable.id);
    res.json(automations);
  } catch (err) {
    req.log.error({ err }, "Error fetching automations");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/run", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [automation] = await db.select().from(automationsTable).where(eq(automationsTable.id, id));
    if (!automation) return res.status(404).json({ error: "Automation not found" });

    const now = new Date().toISOString();
    await db
      .update(automationsTable)
      .set({ lastExecution: now, runsCount: automation.runsCount + 1 })
      .where(eq(automationsTable.id, id));

    res.json({
      success: true,
      message: `Automation "${automation.name}" executed successfully`,
      executedAt: now,
    });
  } catch (err) {
    req.log.error({ err }, "Error running automation");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
