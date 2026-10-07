/**
 * gmail-draft-email skill — closes the "Gmail is read-only" gap flagged in
 * the 2026-10-01 function audit. Mirrors outlook-draft-email's shape
 * exactly (design-spec.md §12.1): a hybrid pipeline, fixed (not
 * model-planned) steps, with the actual send deliberately NOT part of
 * this pipeline - that lives in routes/gmailSkills.ts's /send endpoint,
 * fired only on explicit user confirmation through a ConfirmGate.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { taskRunsTable, type TaskStep } from "@workspace/db";
import { eq } from "drizzle-orm";
import { emitTaskEvent } from "../taskEvents.js";
import { logger } from "../../lib/logger.js";
import * as gmail from "../../lib/gmailApi.js";
import { getAnthropicClient } from "../../lib/anthropicClient.js";

const STEP_LABELS = [
  "Fetch thread",
  "Summarize thread context",
  "Compose reply",
  "Create Gmail draft",
] as const;

function textOf(res: Anthropic.Messages.Message): string {
  const block = res.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text");
  return block?.text?.trim() ?? "";
}

export interface GmailDraftResult {
  taskRunId: string;
  draftId: string;
  originalMessageId: string;
  to: string;
  subject: string;
  body: string;
}

async function setStep(taskRunId: string, steps: TaskStep[], index: number, patch: Partial<TaskStep>): Promise<void> {
  steps[index] = { ...steps[index], ...patch };
  await db.update(taskRunsTable).set({ steps: [...steps], updatedAt: new Date() }).where(eq(taskRunsTable.id, taskRunId));
  emitTaskEvent(taskRunId, { type: "step", step: steps[index] });
}

async function failRun(taskRunId: string, steps: TaskStep[], err: unknown): Promise<never> {
  const errorMessage = err instanceof Error ? err.message : String(err);
  const runningIdx = steps.findIndex((s) => s.status === "running");
  const failedSteps = steps.map((s) => (s.status === "running" ? { ...s, status: "failed" } : s));
  await db
    .update(taskRunsTable)
    .set({ status: "failed", errorMessage, steps: failedSteps, retryFromStep: runningIdx >= 0 ? runningIdx : 0, updatedAt: new Date() })
    .where(eq(taskRunsTable.id, taskRunId));
  emitTaskEvent(taskRunId, { type: "error", error: errorMessage });
  throw err instanceof Error ? err : new Error(errorMessage);
}

/**
 * Runs steps 1-4 against a real Gmail thread, creating a real (unsent)
 * draft. Throws on any failure - the caller (routes/gmailSkills.ts) turns
 * that into an HTTP error response.
 */
export async function runGmailDraftEmail(messageId: string): Promise<GmailDraftResult> {
  const steps: TaskStep[] = STEP_LABELS.map((label, index) => ({ index, label, status: "pending" }));

  const [run] = await db
    .insert(taskRunsTable)
    .values({
      commandText: `gmail-draft-email: reply to message ${messageId}`,
      triggerType: "manual",
      agentId: "gmail-draft-email",
      status: "running",
      steps,
    })
    .returning();

  const taskRunId = run.id;
  emitTaskEvent(taskRunId, { type: "steps", steps });

  try {
    // Step 1 — fetch thread via gmail.modify
    await setStep(taskRunId, steps, 0, { status: "running", startedAt: new Date().toISOString() });
    const message = await gmail.getMessage(messageId);
    const thread = await gmail.getThreadMessages(message.threadId);
    await setStep(taskRunId, steps, 0, {
      status: "done",
      output: `Fetched ${thread.length} message(s) in thread`,
      completedAt: new Date().toISOString(),
    });

    // Step 2 — summarize thread context
    await setStep(taskRunId, steps, 1, { status: "running", startedAt: new Date().toISOString() });
    const threadText = gmail.threadToPlainText(thread);
    const client = await getAnthropicClient();
    const contextSummary = textOf(
      await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system:
          "Summarize this email thread in 2-4 sentences: what's being asked, and the prior tone/context. Reply with only the summary.",
        messages: [{ role: "user", content: threadText }],
      })
    );
    await setStep(taskRunId, steps, 1, { status: "done", output: contextSummary, completedAt: new Date().toISOString() });

    // Step 3 — compose reply
    await setStep(taskRunId, steps, 2, { status: "running", startedAt: new Date().toISOString() });
    const draftText = textOf(
      await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: [
          "Draft a reply to this email thread on the user's behalf.",
          `Context summary: ${contextSummary}`,
          "Match a professional, courteous tone consistent with the thread.",
          "Reply with ONLY the email body text - no subject line, no markdown, no commentary.",
        ].join("\n"),
        messages: [{ role: "user", content: threadText }],
      })
    );
    await setStep(taskRunId, steps, 2, { status: "done", output: "Draft composed", completedAt: new Date().toISOString() });
    await db.update(taskRunsTable).set({ previewContent: draftText, updatedAt: new Date() }).where(eq(taskRunsTable.id, taskRunId));
    emitTaskEvent(taskRunId, { type: "preview", preview: draftText });

    // Step 4 — write the draft via gmail.modify (full MIME content required up front, unlike Graph)
    await setStep(taskRunId, steps, 3, { status: "running", startedAt: new Date().toISOString() });
    const draft = await gmail.createReplyDraft(message, draftText);
    await setStep(taskRunId, steps, 3, {
      status: "done",
      output: `Draft created (${draft.id})`,
      completedAt: new Date().toISOString(),
    });

    // Not "completed" — step 5 (send) hasn't happened yet, and it never
    // happens automatically. "awaiting_confirmation" is an honest status
    // rather than overclaiming the task is done.
    await db
      .update(taskRunsTable)
      .set({ status: "awaiting_confirmation", resultSummary: `Draft ready for ${draft.to}`, updatedAt: new Date() })
      .where(eq(taskRunsTable.id, taskRunId));
    emitTaskEvent(taskRunId, { type: "status", status: "awaiting_confirmation" });

    return { taskRunId, draftId: draft.id, originalMessageId: messageId, to: draft.to, subject: draft.subject, body: draftText };
  } catch (err) {
    logger.error({ err, taskRunId, messageId }, "gmail-draft-email pipeline failed");
    return failRun(taskRunId, steps, err);
  }
}
