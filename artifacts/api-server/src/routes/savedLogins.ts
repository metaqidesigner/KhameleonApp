import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, skillSetsTable } from "@workspace/db";
import { pendingLoginRequests, answerLoginRequest, type LoginChoice } from "../lib/savedLogins.js";

/** Build 7: "Use your … login?" questions waiting for the user, and linking a login to a skill. */
const router = Router();

router.get("/pending", (_req, res) => { res.json(pendingLoginRequests()); });

router.post("/:id/answer", async (req, res) => {
  const choice = (req.body ?? {}).choice as LoginChoice;
  if (!["once", "always", "no"].includes(choice)) { res.status(400).json({ error: "Choose once, always or no." }); return; }
  res.json({ answered: await answerLoginRequest(String(req.params.id), choice) });
});

router.put("/skills/:skillId", async (req, res) => {
  const vaultItemId = (req.body ?? {}).vaultItemId;
  const value = typeof vaultItemId === "number" ? vaultItemId : null;
  const [row] = await db.update(skillSetsTable).set({ loginVaultItemId: value }).where(eq(skillSetsTable.id, Number(req.params.skillId))).returning({ id: skillSetsTable.id, loginVaultItemId: skillSetsTable.loginVaultItemId });
  if (!row) { res.status(404).json({ error: "Skill not found" }); return; }
  res.json(row);
});

export default router;
