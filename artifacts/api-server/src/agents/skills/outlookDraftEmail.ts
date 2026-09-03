/**
 * outlook-draft-email skill (design-spec.md §12.1) — a hybrid pipeline:
 * deterministic fetch/summarize, instructional compose, deterministic draft
 * creation. Steps are FIXED, not model-planned — unlike the generic
 * task-executor.ts (which plans its own freeform steps per command via
 * planSteps()), a pipeline skill's steps map one-to-one onto trace column
 * rows (§11.2), so they're hardcoded here to match §12.1 exactly.
 *
 * Step 5 — the actual Mail.Send call — is deliberately NOT part of this
 * pipeline. It lives in routes/outlookSkills.ts's /send endpoint, fired
 * only on explicit user confirmation through a ConfirmGate, per §12.1's
 * own note: "a distinct, user-initiated action rather than something the
 * skill executes on its own."
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { taskRunsTable, type TaskStep } from "@workspace/db";
import { eq } from "drizzle-orm";
import { emitTaskEvent } from "../taskEvents.js";
import { logger } from "../../lib/logger.js";
import * as graph from "../../lib/outlookGraph.js";

const STEP_LABELS = [
  "Fetch thread",
  "Summarize thread context",
  "Compose reply",
  "Create Outlook draft",
] as const;

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? undefined,
  });
}

function textOf(res: Anthropic.Messages.Message): string {
  const block = res.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text");
  return block?.text?.trim() ?? "";
}

export interface DraftEmailResult {
  taskRunId: string;
  draftId: string;
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
 * Runs steps 1-4 of the outlook-draft-email pipeline against a real
 * Microsoft Graph thread, creating a real (unsent) draft. Throws on any
 * failure — the caller (routes/outlookSkills.ts) is responsible for
 * turning that into an HTTP error response.
 */
export async function runOutlookDraftEmail(messageId: string): Promise<DraftEmailResult> {
  const steps: TaskStep[] = STEP_LABELS.map((label, index) => ({ index, label, status: "pending" }));

  const [run] = await db
    .insert(taskRunsTable)
    .values({
      commandText: `outlook-draft-email: reply to message ${messageId}`,
      triggerType: "manual",
      agentId: "outlook-draft-email",
      status: "running",
      steps,
    })
    .returning();

  const taskRunId = run.id;
  emitTaskEvent(taskRunId, { type: "steps", steps });

  try {
    // Step 1 — pipeline: fetch thread via Mail.Read
    await setStep(taskRunId, steps, 0, { status: "running", startedAt: new Date().toISOString() });
    const message = await graph.getMessage(messageId);
    const thread = await graph.listConversationMessages(message.conversationId);
    await setStep(taskRunId, steps, 0, {
      status: "done",
      output: `Fetched ${thread.length} message(s) in thread`,
      completedAt: new Date().toISOString(),
    });

    // Step 2 — pipeline: summarize thread context
    await setStep(taskRunId, steps, 1, { status: "running", startedAt: new Date().toISOString() });
    const threadText = graph.threadToPlainText(thread);
    const client = getClient();
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

    // Step 3 — instructional: compose reply using context_summary and tone, per the router agent's judgment
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

    // Step 4 — pipeline: write draft_text as an Outlook draft via Mail.ReadWrite
    await setStep(taskRunId, steps, 3, { status: "running", startedAt: new Date().toISOString() });
    const draft = await graph.createReplyDraft(messageId);
    await graph.updateDraftBody(draft.id, draftText);
    await setStep(taskRunId, steps, 3, {
      status: "done",
      output: `Draft created (${draft.id})`,
      completedAt: new Date().toISOString(),
    });

    const to = graph.recipientLine(message);
    const subject = graph.replySubject(message.subject);

    // Not "completed" — step 5 (send) hasn't happened yet, and per §12.1 it
    // never happens automatically. "awaiting_confirmation" makes that an
    // honest status rather than overclaiming the task is done.
    await db
      .update(taskRunsTable)
      .set({ status: "awaiting_confirmation", resultSummary: `Draft ready for ${to}`, updatedAt: new Date() })
      .where(eq(taskRunsTable.id, taskRunId));
    emitTaskEvent(taskRunId, { type: "status", status: "awaiting_confirmation" });

    return { taskRunId, draftId: draft.id, to, subject, body: draftText };
  } catch (err) {
    logger.error({ err, taskRunId, messageId }, "outlook-draft-email pipeline failed");
    return failRun(taskRunId, steps, err);
  }
}
