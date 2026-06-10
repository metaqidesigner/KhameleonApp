import { Router } from "express";
import { db } from "@workspace/db";
import { insightsTable } from "@workspace/db";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const insights = await db.select().from(insightsTable).orderBy(insightsTable.createdAt);
    res.json(insights.reverse());
  } catch (err) {
    req.log.error({ err }, "Error fetching insights");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
