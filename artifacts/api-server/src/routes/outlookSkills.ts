/**
 * outlook-draft-email skill (design-spec.md §12.1) HTTP surface.
 *
 *   POST /api/skills/outlook-draft-email             — run steps 1-4, return the draft for review
 *   POST /api/skills/outlook-draft-email/:id/send     — step 5: the actual Mail.Send call, gated on confirmation
 *   POST /api/skills/outlook-draft-email/:id/reject   — discard the draft without sending
 *
 * The `:id` in /send and /reject is an approvals row id (§6.5.2 action
 * receipts / §6.5.3 confirm gates) created by the first call — the same
 * approvalsTable the ConfirmGate demo on the Approvals page already uses,
 * so this skill's confirmation produces a real durable record, not a
 * parallel bookkeeping system.
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { approvalsTable, taskRunsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isConnected } from "../lib/oauthTokens.js";
import { runOutlookDraftEmail } from "../agents/skills/outlookDraftEmail.js";
import * as graph from "../lib/outlookGraph.js";
import { emitTaskEvent, taskEvents } from "../agents/taskEvents.js";
import { getAnthropicClient } from "../lib/anthropicClient.js";
import type Anthropic from "@anthropic-ai/sdk";

function textOf(res: Anthropic.Messages.Message): string {
  const block = res.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text");
  return block?.text?.trim() ?? "";
}

const router = Router();

interface ApprovalPayload {
  taskRunId: string;
  draftId: string;
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
    if (!(await isConnected("microsoft"))) {
      res.status(409).json({ error: "Outlook is not connected. Connect it at /api/auth/oauth/microsoft/start." });
      return;
    }

    const { messageId } = req.body as { messageId?: string };
    if (!messageId?.trim()) {
      res.status(400).json({ error: "messageId is required" });
      return;
    }

    const result = await runOutlookDraftEmail(messageId.trim());
    const payload: ApprovalPayload = {
      taskRunId: result.taskRunId,
      draftId: result.draftId,
      to: result.to,
      subject: result.subject,
      body: result.body,
    };

    const [approval] = await db
      .insert(approvalsTable)
      .values({
        action: "outlook-draft-email:send",
        requestingAgent: "outlook-draft-email",
        reason: "Draft reply ready for review before sending - Mail.Send is never called automatically (§12.1).",
        riskLevel: "critical",
        dataInvolved: JSON.stringify(payload),
      })
      .returning();

    res.status(201).json({ approvalId: approval.id, ...payload });
  } catch (err) {
    req.log.error({ err }, "outlook-draft-email run failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Pipeline failed" });
  }
});

// ── POST /:id/send — step 5, the only Mail.Send call in this skill ───────────

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
    // sending. stripSubjectPrefix undoes the "Subject: X\n\n" the frontend
    // prepends for display (ConfirmGate has no separate subject field) -
    // that line must never end up as literal text in a real sent email.
    if (typeof editedBody === "string" && editedBody.trim() && editedBody !== payload.body) {
      await graph.updateDraftBody(payload.draftId, graph.stripSubjectPrefix(editedBody));
    }

    await graph.sendDraft(payload.draftId);

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
    req.log.error({ err }, "outlook-draft-email send failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Send failed" });
  }
});

// ── POST /:id/rewrite — re-compose with a different tone, per the Mobile ─────
// Morning Briefing's voice "change the tone" command. One real re-compose
// pass (reruns the same Claude call outlookDraftEmail.ts's own step 3
// makes, parameterized by the heard instruction) - not an open-ended
// conversational rewrite loop. Writes the new body back to both the real
// Outlook draft and the approval row, so a later /send uses the rewrite.

router.post("/:id/rewrite", async (req: Request, res: Response) => {
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
    const { toneInstruction } = req.body as { toneInstruction?: string };

    const client = await getAnthropicClient();
    const newBody = textOf(
      await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: [
          "Rewrite this email reply with a different tone, per the user's spoken instruction.",
          toneInstruction?.trim()
            ? `Instruction: ${toneInstruction.trim()}`
            : "No specific instruction was understood - make it noticeably warmer and more casual than the current draft.",
          "Reply with ONLY the new email body text - no subject line, no markdown, no commentary.",
        ].join("\n"),
        messages: [{ role: "user", content: payload.body }],
      })
    );

    await graph.updateDraftBody(payload.draftId, newBody);
    const updatedPayload: ApprovalPayload = { ...payload, body: newBody };
    await db.update(approvalsTable).set({ dataInvolved: JSON.stringify(updatedPayload) }).where(eq(approvalsTable.id, id));

    res.json({ approvalId: id, ...updatedPayload });
  } catch (err) {
    req.log.error({ err }, "outlook-draft-email rewrite failed");
    res.status(502).json({ error: err instanceof Error ? err.message : "Rewrite failed" });
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
      await graph.deleteDraft(payload.draftId);
    } catch (err) {
      // Best-effort - rejecting must still succeed even if Outlook cleanup fails.
      req.log.warn({ err }, "Failed to delete rejected draft (non-fatal)");
    }

    const now = new Date();
    await db.update(approvalsTable).set({ status: "rejected", resolvedAt: now.toISOString() }).where(eq(approvalsTable.id, id));
    await db.update(taskRunsTable).set({ status: "cancelled", updatedAt: now }).where(eq(taskRunsTable.id, payload.taskRunId));
    taskEvents.emit(`task:${payload.taskRunId}`, { type: "cancelled", taskId: payload.taskRunId });

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "outlook-draft-email reject failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
