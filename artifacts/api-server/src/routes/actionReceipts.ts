import { Router } from "express";
import { db } from "@workspace/db";
import { actionReceiptsTable } from "@workspace/db";
import { CreateActionReceiptBody } from "@workspace/api-zod";

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

/**
 * Closes the gap found in the 2026-10-01 §6.5.2 audit: sending a real
 * email through the outlook-draft-email hard gate never wrote a durable
 * receipt, only local React state that vanished on reload — exactly the
 * "toast standing in for the record" this section says isn't acceptable.
 * Same table/pattern already used by skillSets.ts and auth.ts.
 */
router.post("/", async (req, res) => {
  try {
    const parsed = CreateActionReceiptBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.issues });

    const [row] = await db.insert(actionReceiptsTable).values(parsed.data).returning();
    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Error creating action receipt");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
