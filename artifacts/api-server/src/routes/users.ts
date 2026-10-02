/**
 * Account management (hosted/managed mode, Phase 4 - khameleon-decisions-log.md,
 * 2026-10-03). Admin-only - no accounts mode means no users table rows at
 * all, so these routes are only ever meaningful once at least one admin
 * exists; appAuthGate already requires a valid account session for
 * everything under /api once accounts mode is active, same as every other
 * route.
 *
 * GET   /api/users       → list every account (admin only)
 * PATCH /api/users/:id   → { active } - activate/deactivate an account (admin only)
 */

import { Router, type Request, type Response } from "express";
import { toPublicUser } from "@workspace/db";
import { getCurrentUserId } from "../lib/requestContext.js";
import { getUserById, listUsers, setUserActive } from "../lib/accounts.js";

const router = Router();

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const userId = getCurrentUserId();
  const requester = userId !== undefined ? await getUserById(userId) : undefined;
  if (!requester?.isAdmin) {
    res.status(403).json({ error: "Admin access required." });
    return false;
  }
  return true;
}

router.get("/", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  res.json(await listUsers());
});

router.patch("/:id", async (req: Request, res: Response) => {
  if (!(await requireAdmin(req, res))) return;
  const id = parseInt(String(req.params.id), 10);
  const { active } = req.body as { active?: unknown };
  if (typeof active !== "boolean") {
    res.status(400).json({ error: "`active` must be a boolean." });
    return;
  }
  if (id === getCurrentUserId() && !active) {
    res.status(400).json({ error: "You can't deactivate your own account." });
    return;
  }
  const target = await getUserById(id);
  if (!target) {
    res.status(404).json({ error: "Account not found." });
    return;
  }
  await setUserActive(id, active);
  res.json(toPublicUser({ ...target, active }));
});

export default router;
