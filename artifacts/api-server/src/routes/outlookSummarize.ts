/**
 * outlook-summarize-thread skill (design-spec.md §12.2) HTTP surface.
 *
 *   POST /api/skills/outlook-summarize-thread { messageId }
 *
 * No /send or /reject here, unlike outlook-draft-email — this skill has no
 * confirm-gated step. It runs to completion in one call (§6.5.3: reading
 * and summarizing is local/cheap/reversible, not an expensive or
 * hard-to-reverse action, so it never needs a hard gate).
 */

import { Router, type Request, type Response } from "express";
import { isConnected } from "../lib/oauthTokens.js";
import { runOutlookSummarizeThread } from "../agents/skills/outlookSummarizeThread.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    if (!(await isConnected("microsoft"))) {
      res.status(409).json({ error: "Outlook is not connected. Connect it at /api/auth/oauth/microsoft/start." });
      return;
    }

    const { messageId } = req.body as { messageId?: string };
    if (!messageId?.trim()) {
      res.status(400).json({ error: "messageId is required" });
      return;
    }

    const result = await runOutlookSummarizeThread(messageId.trim());
    res.status(201).json(result);
  } catch (err) {
    req.log.error({ err }, "outlook-summarize-thread run failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Pipeline failed" });
  }
});

export default router;
