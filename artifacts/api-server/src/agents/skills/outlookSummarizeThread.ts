/**
 * outlook-summarize-thread skill (design-spec.md §12.2) — pipeline-only,
 * Mail.Read only. "Simplest of the three [Outlook skills] — a good first
 * candidate to build, since it exercises the pipeline format end-to-end
 * without needing the instructional fallback or a confirm step" (§12.2).
 *
 * No confirm gate: per §6.5.3, a gate is for actions that are expensive,
 * hard to reverse, or affect someone else. Reading and summarizing a
 * thread is none of those — it's a quiet action receipt (§6.5.2), not a
 * ConfirmGate, unlike outlook-draft-email's send step.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { taskRunsTable, type TaskStep } from "@workspace/db";
import { eq } from "drizzle-orm";
import { emitTaskEvent } from "../taskEvents.js";
import { logger } from "../../lib/logger.js";
import * as graph from "../../lib/outlookGraph.js";

const STEP_LABELS = ["Fetch thread", "Summarize into plain language"] as const;

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

export interface SummarizeThreadResult {
  taskRunId: string;
  summary: string;
  participants: string[];
  messageCount: number;
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

/** Pure helper: unique sender addresses across a thread, in first-seen order. */
export function distinctParticipants(messages: Pick<graph.GraphMessage, "from">[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of messages) {
    const addr = m.from?.emailAddress?.address;
    if (addr && !seen.has(addr)) {
      seen.add(addr);
      out.push(addr);
    }
  }
  return out;
}

export async function runOutlookSummarizeThread(messageId: string): Promise<SummarizeThreadResult> {
  const steps: TaskStep[] = STEP_LABELS.map((label, index) => ({ index, label, status: "pending" }));

  const [run] = await db
    .insert(taskRunsTable)
    .values({
      commandText: `outlook-summarize-thread: message ${messageId}`,
      triggerType: "manual",
      agentId: "outlook-summarize-thread",
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

    // Step 2 — pipeline: summarize into plain language (participants, ask, current status)
    await setStep(taskRunId, steps, 1, { status: "running", startedAt: new Date().toISOString() });
    const threadText = graph.threadToPlainText(thread);
    const client = getClient();
    const summary = textOf(
      await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: [
          "Summarize this email thread in plain language for someone who hasn't read it.",
          "Cover: who's involved, what's being asked, and the current status.",
          "Reply with ONLY the summary - no markdown, no commentary.",
        ].join("\n"),
        messages: [{ role: "user", content: threadText }],
      })
    );
    await setStep(taskRunId, steps, 1, { status: "done", output: "Summary produced", completedAt: new Date().toISOString() });

    const participants = distinctParticipants(thread);

    await db
      .update(taskRunsTable)
      .set({
        status: "completed",
        previewContent: summary,
        resultSummary: summary.length > 160 ? `${summary.slice(0, 157)}...` : summary,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(taskRunsTable.id, taskRunId));
    emitTaskEvent(taskRunId, { type: "done", summary, preview: summary });

    return { taskRunId, summary, participants, messageCount: thread.length };
  } catch (err) {
    logger.error({ err, taskRunId, messageId }, "outlook-summarize-thread pipeline failed");
    return failRun(taskRunId, steps, err);
  }
}
