/**
 * GET /api/skills/gmail-messages — browse recent inbox messages. Mirrors
 * routes/outlookMessages.ts exactly: not a skill itself, just a shared
 * read-only endpoint so the frontend can let a user pick a real message
 * instead of pasting a raw Gmail message id. Backs the inbox browser on
 * the Approvals page for gmail-draft-email.
 */

import { Router, type Request, type Response } from "express";
import { isConnected } from "../lib/oauthTokens.js";
import { listRecentInboxMessages } from "../lib/gmailApi.js";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    if (!(await isConnected("google"))) {
      res.status(409).json({ error: "Gmail is not connected. Connect it at /api/auth/oauth/google/start." });
      return;
    }

    const messages = await listRecentInboxMessages(15);
    res.json(
      messages.map((m) => ({
        id: m.id,
        subject: m.subject,
        from: m.from,
        preview: m.preview,
        receivedDateTime: new Date(parseInt(m.internalDate, 10)).toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "gmail-messages list failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Could not list messages" });
  }
});

export default router;
