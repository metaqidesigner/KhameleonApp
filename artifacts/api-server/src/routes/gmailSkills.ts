/**
 * gmail-draft-email skill HTTP surface — mirrors routes/outlookSkills.ts
 * exactly. Closes the "Gmail is read-only" gap (2026-10-01 function audit).
 *
 *   POST /api/skills/gmail-draft-email             — run steps 1-4, return the draft for review
 *   POST /api/skills/gmail-draft-email/:id/send     — step 5: the actual gmail.send call, gated on confirmation
 *   POST /api/skills/gmail-draft-email/:id/reject   — discard the draft without sending
 *
 * The `:id` is an approvals row id (§6.5.2 action receipts / §6.5.3
 * confirm gates), same approvalsTable the Outlook skill and the Approvals
 * page's ConfirmGate demo already use.
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { approvalsTable, taskRunsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isConnected } from "../lib/oauthTokens.js";
import { runGmailDraftEmail } from "../agents/skills/gmailDraftEmail.js";
import * as gmail from "../lib/gmailApi.js";
import { emitTaskEvent, taskEvents } from "../agents/taskEvents.js";

const router = Router();

interface ApprovalPayload {
  taskRunId: string;
  draftId: string;
  originalMessageId: string;
  to: string;
  subject: string;
  body: string;
}

function parsePayload(dataInvolved: string): ApprovalPayload {
  return JSON.parse(dataInvolved) as ApprovalPayload;
}

// ── POST / — run the pipeline (steps 1-4) ─────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  try {
    if (!(await isConnected("google"))) {
      res.status(409).json({ error: "Gmail is not connected. Connect it at /api/auth/oauth/google/start." });
      return;
    }

    const { messageId } = req.body as { messageId?: string };
    if (!messageId?.trim()) {
      res.status(400).json({ error: "messageId is required" });
      return;
    }

    const result = await runGmailDraftEmail(messageId.trim());
    const payload: ApprovalPayload = {
      taskRunId: result.taskRunId,
      draftId: result.draftId,
      originalMessageId: result.originalMessageId,
      to: result.to,
      subject: result.subject,
      body: result.body,
    };

    const [approval] = await db
      .insert(approvalsTable)
      .values({
        action: "gmail-draft-email:send",
        requestingAgent: "gmail-draft-email",
        reason: "Draft reply ready for review before sending - gmail.send is never called automatically (§12.1).",
        riskLevel: "critical",
        dataInvolved: JSON.stringify(payload),
      })
      .returning();

    res.status(201).json({ approvalId: approval.id, ...payload });
  } catch (err) {
    req.log.error({ err }, "gmail-draft-email run failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Pipeline failed" });
  }
});

// ── POST /:id/send — step 5, the only gmail.send call in this skill ──────────

router.post("/:id/send", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [approval] = await db.select().from(approvalsTable).where(eq(approvalsTable.id, id)).limit(1);
    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }
    if (approval.status !== "pending") {
      res.status(409).json({ error: `Approval already ${approval.status}` });
      return;
    }

    const payload = parsePayload(approval.dataInvolved);
    const { editedBody } = req.body as { editedBody?: string };

    // §6.5.4 intent preview: editing happens before approval, not after -
    // if the user edited the payload in ConfirmGate, write it back before
    // sending. Gmail has no partial-update for just the body, so the
    // original message is re-fetched to rebuild the full MIME content.
    if (typeof editedBody === "string" && editedBody.trim() && editedBody !== payload.body) {
      const original = await gmail.getMessage(payload.originalMessageId);
      await gmail.updateDraftBody(payload.draftId, original, gmail.stripSubjectPrefix(editedBody));
    }

    await gmail.sendDraft(payload.draftId);

    const now = new Date();
    await db.update(approvalsTable).set({ status: "approved", resolvedAt: now.toISOString() }).where(eq(approvalsTable.id, id));
    await db
      .update(taskRunsTable)
      .set({ status: "completed", resultSummary: `Sent to ${payload.to}`, completedAt: now, updatedAt: now })
      .where(eq(taskRunsTable.id, payload.taskRunId));
    emitTaskEvent(payload.taskRunId, { type: "done", summary: `Sent to ${payload.to}` });

    res.json({ ok: true, sentAt: now.toISOString() });
  } catch (err) {
    // Deliberately does NOT mark the approval resolved on failure - a failed
    // send must stay retryable, never silently recorded as sent.
    req.log.error({ err }, "gmail-draft-email send failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Send failed" });
  }
});

// ── POST /:id/reject — discard without sending ────────────────────────────────

router.post("/:id/reject", async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [approval] = await db.select().from(approvalsTable).where(eq(approvalsTable.id, id)).limit(1);
    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }
    if (approval.status !== "pending") {
      res.status(409).json({ error: `Approval already ${approval.status}` });
      return;
    }

    const payload = parsePayload(approval.dataInvolved);

    try {
      await gmail.deleteDraft(payload.draftId);
    } catch (err) {
      // Best-effort - rejecting must still succeed even if Gmail cleanup fails.
      req.log.warn({ err }, "Failed to delete rejected draft (non-fatal)");
    }

    const now = new Date();
    await db.update(approvalsTable).set({ status: "rejected", resolvedAt: now.toISOString() }).where(eq(approvalsTable.id, id));
    await db.update(taskRunsTable).set({ status: "cancelled", updatedAt: now }).where(eq(taskRunsTable.id, payload.taskRunId));
    taskEvents.emit(`task:${payload.taskRunId}`, { type: "cancelled", taskId: payload.taskRunId });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "gmail-draft-email reject failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
