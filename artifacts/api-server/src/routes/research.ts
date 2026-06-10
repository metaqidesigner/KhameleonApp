import { Router } from "express";
import { db } from "@workspace/db";
import { researchItemsTable } from "@workspace/db";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const items = await db.select().from(researchItemsTable).orderBy(researchItemsTable.createdAt);
    res.json(items.reverse());
  } catch (err) {
    req.log.error({ err }, "Error fetching research items");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
