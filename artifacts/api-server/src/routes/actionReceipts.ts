import { Router } from "express";
import { db } from "@workspace/db";
import { actionReceiptsTable } from "@workspace/db";

const router = Router();

/**
 * design-spec.md §6.5.2 — the durable action-receipts log. First real
 * backend for components/ActionReceipt.tsx / ActionReceiptList, which
 * until now only ever rendered from local demo state in approvals.tsx.
 */
router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(actionReceiptsTable).orderBy(actionReceiptsTable.createdAt);
    res.json(rows.reverse());
  } catch (err) {
    req.log.error({ err }, "Error fetching action receipts");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
