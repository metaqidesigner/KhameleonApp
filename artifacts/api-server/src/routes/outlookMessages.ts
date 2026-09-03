/**
 * GET /api/skills/outlook-messages — browse recent inbox messages.
 *
 * Not a skill itself: a small, shared, read-only endpoint so the frontend
 * can let a user pick a real message instead of requiring them to paste a
 * raw Graph message id (previously the only way in — the verification
 * runbook in replit.md even documents fetching one via Graph Explorer as a
 * workaround). Backs the inbox browser on the Approvals page for both
 * outlook-draft-email and outlook-summarize-thread.
 */

import { Router, type Request, type Response } from "express";
import { isConnected } from "../lib/oauthTokens.js";
import { listRecentInboxMessages, stripHtml } from "../lib/outlookGraph.js";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    if (!(await isConnected("microsoft"))) {
      res.status(409).json({ error: "Outlook is not connected. Connect it at /api/auth/oauth/microsoft/start." });
      return;
    }

    const messages = await listRecentInboxMessages(15);
    res.json(
      messages.map((m) => ({
        id: m.id,
        subject: m.subject || "(no subject)",
        from: m.from?.emailAddress?.address ?? "(unknown sender)",
        preview: stripHtml(m.bodyPreview || "").slice(0, 140),
        receivedDateTime: m.receivedDateTime,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "outlook-messages list failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Could not list messages" });
  }
});

export default router;
