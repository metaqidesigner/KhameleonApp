/**
 * GET /api/briefing/today — the real, assembled Mobile Morning Briefing.
 * See ../briefing.ts for the orchestration; this route is a thin wrapper.
 */

import { Router, type Request, type Response } from "express";
import { assembleMorningBriefing } from "../briefing.js";

const router = Router();

router.get("/today", async (req: Request, res: Response) => {
  try {
    const briefing = await assembleMorningBriefing();
    res.json(briefing);
  } catch (err) {
    req.log.error({ err }, "Failed to assemble morning briefing");
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to assemble briefing" });
  }
});

export default router;
