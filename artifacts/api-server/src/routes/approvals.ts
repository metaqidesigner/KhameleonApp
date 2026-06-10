import { Router } from "express";
import { db } from "@workspace/db";
import { approvalsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const approvals = await db.select().from(approvalsTable).orderBy(approvalsTable.createdAt);
    res.json(approvals.reverse());
  } catch (err) {
    req.log.error({ err }, "Error fetching approvals");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const now = new Date().toISOString();
    const [updated] = await db
      .update(approvalsTable)
      .set({ status: "approved", resolvedAt: now })
      .where(eq(approvalsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Approval not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error approving request");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const now = new Date().toISOString();
    const [updated] = await db
      .update(approvalsTable)
      .set({ status: "rejected", resolvedAt: now })
      .where(eq(approvalsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Approval not found" });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error rejecting request");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
