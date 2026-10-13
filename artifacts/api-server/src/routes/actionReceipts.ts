import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { actionReceiptsTable, skillSetsTable } from "@workspace/db";
import { CreateActionReceiptBody } from "@workspace/api-zod";
import { undoPlanFor } from "../lib/receiptUndo.js";
import { deleteToken } from "../lib/oauthTokens.js";

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

/**
 * Undo from the activity log (gap review Q10/Q14). Only actions with a
 * real reverse are accepted (lib/receiptUndo.ts); the original receipt is
 * marked undone and the undo itself is logged as its own receipt.
 */
router.post("/:id/undo", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [receipt] = await db.select().from(actionReceiptsTable).where(eq(actionReceiptsTable.id, id));
    if (!receipt) return res.status(404).json({ error: "Not found" });

    const plan = undoPlanFor(receipt);
    if (!plan) return res.status(400).json({ error: "This action can't be undone." });

    let description: string;
    if (plan.kind === "uninstall-skill") {
      const updated = await db.update(skillSetsTable)
        .set({ status: "uninstalled" })
        .where(and(eq(skillSetsTable.name, plan.skillName), eq(skillSetsTable.status, "installed")))
        .returning();
      if (updated.length === 0) return res.status(409).json({ error: `"${plan.skillName}" isn't installed any more.` });
      description = `Undid install of "${plan.skillName}"`;
    } else {
      await deleteToken(plan.provider);
      description = `Disconnected ${plan.provider} (undo of connecting; anything already done while connected isn't undone)`;
    }

    const [marked] = await db.update(actionReceiptsTable).set({ undone: true }).where(eq(actionReceiptsTable.id, id)).returning();
    await db.insert(actionReceiptsTable).values({
      description, category: "undo", scope: receipt.scope, outcome: "success", target: receipt.target, canUndo: false,
    });
    return res.json(marked);
  } catch (err) {
    req.log.error({ err }, "Error undoing action");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
