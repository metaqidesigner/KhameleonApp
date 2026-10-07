/**
 * GET /api/quota — the real per-minute rate-limit snapshot Anthropic/OpenAI
 * last reported on an actual response (see lib/providerQuota.ts for what
 * this is and, deliberately, isn't). Empty for a provider until at least
 * one real call has gone through it since the server started.
 */
import { Router, type Request, type Response } from "express";
import { getQuotaSnapshots } from "../lib/providerQuota.js";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  res.json(getQuotaSnapshots());
});

export default router;
