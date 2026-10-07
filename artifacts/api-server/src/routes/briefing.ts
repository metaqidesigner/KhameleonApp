/**
 * GET /api/briefing/today — the real, assembled Mobile Morning Briefing.
 * See ../briefing.ts for the orchestration; this route is a thin wrapper.
 */

import { Router, type Request, type Response } from "express";
import { assembleMorningBriefing, recordBriefingTurn, InvalidBriefingTurnError } from "../briefing.js";

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

/**
 * POST /api/briefing/session/log — records one real turn of a Mobile
 * Briefing run so the desktop Chat Window can later resume it as a real
 * conversation. See recordBriefingTurn in ../briefing.ts for why this
 * exists and what it actually does; this route is a thin HTTP wrapper,
 * same as GET /today above.
 */
router.post("/session/log", async (req: Request, res: Response) => {
  try {
    const { sessionId, role, content } = req.body as { sessionId?: unknown; role?: unknown; content?: unknown };
    await recordBriefingTurn(
      typeof sessionId === "string" ? sessionId : "",
      typeof role === "string" ? role : "",
      typeof content === "string" ? content : "",
    );
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof InvalidBriefingTurnError) {
      return res.status(400).json({ error: err.message });
    }
    req.log.error({ err }, "Failed to log briefing conversation turn");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
