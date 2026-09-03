/**
 * outlook-triage-inbox skill (design-spec.md §12.3) — hybrid: deterministic
 * fetch/classify-by-rule, instructional judgment for ambiguous cases,
 * deterministic actions. The third and most complex of the three named
 * Outlook skills.
 *
 * No ConfirmGate here, unlike outlook-draft-email: flagging, categorizing,
 * and archiving only touch the user's own mailbox and are all easily
 * reversible (§6.5.3 - not expensive, not hard to reverse, doesn't affect
 * anyone else) - so this is a quiet action receipt with REAL undo (§6.5.2),
 * not a hard gate.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@workspace/db";
import { taskRunsTable, tasksTable, type TaskStep } from "@workspace/db";
import { eq } from "drizzle-orm";
import { emitTaskEvent } from "../taskEvents.js";
import { logger } from "../../lib/logger.js";
import * as graph from "../../lib/outlookGraph.js";

const STEP_LABELS = [
  "Fetch unread mail",
  "Classify by rule",
  "Classify remaining by judgment",
  "Apply actions",
  "Extract action items",
] as const;

export type TriageClassification = "urgent" | "action_needed" | "fyi" | "low_priority";

export interface TriageAction {
  flagStatus?: "flagged";
  category: string;
  archive?: boolean;
}

/** What each classification does to a message. Exported so the frontend/tests can reason about it without duplicating the mapping. */
export const ACTION_BY_CLASSIFICATION: Record<TriageClassification, TriageAction> = {
  urgent: { flagStatus: "flagged", category: "Urgent" },
  action_needed: { category: "Action Needed" },
  fyi: { category: "FYI", archive: true },
  low_priority: { category: "Low Priority", archive: true },
};

const URGENT_PATTERN = /\b(urgent|asap|action required|time[- ]sensitive)\b/i;
const ACTION_PATTERN = /\b(please review|please approve|sign off|approval needed|can you|could you)\b|\?/i;
const AUTOMATED_SENDER_PATTERN = /no-?reply|notifications?@|newsletter|do-?not-?reply|automated/i;
const FYI_PATTERN = /^\s*(fwd:|fyi\b)/i;

/**
 * Rule-based classification (§12.3 step 2) — confident, sender/subject-
 * pattern based. Returns null when no rule matches confidently, meaning
 * the message needs instructional judgment (step 3).
 */
export function classifyByRule(message: Pick<graph.GraphMessage, "subject" | "from">): TriageClassification | null {
  const subject = message.subject ?? "";
  const fromAddress = message.from?.emailAddress?.address ?? "";

  if (URGENT_PATTERN.test(subject)) return "urgent";
  if (AUTOMATED_SENDER_PATTERN.test(fromAddress) || FYI_PATTERN.test(subject)) return "fyi";
  if (ACTION_PATTERN.test(subject)) return "action_needed";
  return null;
}

function isTriageClassification(value: unknown): value is TriageClassification {
  return value === "urgent" || value === "action_needed" || value === "fyi" || value === "low_priority";
}

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

function parseJsonArray(text: string): unknown[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** What's needed to undo one message's triage action. */
export interface TriageUndoEntry {
  /** The message's CURRENT id after any move — this is what a later action must address, not the original inbox id. */
  currentId: string;
  originalId: string;
  wasArchived: boolean;
  previousCategories: string[];
  previousFlagStatus: string;
}

export interface TriageItem {
  id: string;
  subject: string;
  from: string;
  classification: TriageClassification;
  source: "rule" | "judgment";
  actionTaken: string;
  undo: TriageUndoEntry;
}

/** An extracted action item, plus the real Task row created for it (if creation succeeded). */
export interface TriageActionItem {
  text: string;
  taskId: number | null;
  sourceMessageId: string;
}

export interface TriageResult {
  taskRunId: string;
  items: TriageItem[];
  actionItems: TriageActionItem[];
  counts: Record<TriageClassification, number>;
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

interface ClassifiedMessage {
  message: graph.GraphMessage;
  classification: TriageClassification;
  source: "rule" | "judgment";
}

export async function runOutlookTriageInbox(): Promise<TriageResult> {
  const steps: TaskStep[] = STEP_LABELS.map((label, index) => ({ index, label, status: "pending" }));

  const [run] = await db
    .insert(taskRunsTable)
    .values({
      commandText: "outlook-triage-inbox: classify unread mail",
      triggerType: "manual",
      agentId: "outlook-triage-inbox",
      status: "running",
      steps,
    })
    .returning();

  const taskRunId = run.id;
  emitTaskEvent(taskRunId, { type: "steps", steps });

  try {
    // Step 1 — pipeline: fetch unread mail via Mail.Read
    await setStep(taskRunId, steps, 0, { status: "running", startedAt: new Date().toISOString() });
    const unread = await graph.listUnreadInboxMessages();
    await setStep(taskRunId, steps, 0, {
      status: "done",
      output: `Fetched ${unread.length} unread message(s)`,
      completedAt: new Date().toISOString(),
    });

    // Step 2 — pipeline: apply rule-based classification where confident
    await setStep(taskRunId, steps, 1, { status: "running", startedAt: new Date().toISOString() });
    const classified: ClassifiedMessage[] = [];
    const unclassified: graph.GraphMessage[] = [];
    for (const message of unread) {
      const rule = classifyByRule(message);
      if (rule) classified.push({ message, classification: rule, source: "rule" });
      else unclassified.push(message);
    }
    await setStep(taskRunId, steps, 1, {
      status: "done",
      output: `${classified.length} classified by rule, ${unclassified.length} need judgment`,
      completedAt: new Date().toISOString(),
    });

    // Step 3 — instructional: for unclassified items, classify using judgment
    await setStep(taskRunId, steps, 2, { status: "running", startedAt: new Date().toISOString() });
    if (unclassified.length > 0) {
      const client = getClient();
      const listing = unclassified
        .map((m, i) => `${i}. From: ${m.from?.emailAddress?.address ?? "unknown"} | Subject: ${m.subject} | Preview: ${m.bodyPreview}`)
        .join("\n");
      const response = textOf(
        await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          system: [
            "Classify each numbered email into exactly one of: urgent, action_needed, fyi, low_priority.",
            "urgent = needs attention very soon. action_needed = a decision or reply is expected, not urgent.",
            "fyi = informational, no action expected. low_priority = safe to defer or ignore.",
            'Reply with ONLY a JSON array like [{"index": 0, "classification": "fyi"}, ...] - one entry per email, same order.',
          ].join("\n"),
          messages: [{ role: "user", content: listing }],
        })
      );
      const parsed = parseJsonArray(response) as { index?: number; classification?: string }[];
      for (const entry of parsed) {
        if (typeof entry.index !== "number" || !unclassified[entry.index]) continue;
        const classification = isTriageClassification(entry.classification) ? entry.classification : "low_priority";
        classified.push({ message: unclassified[entry.index], classification, source: "judgment" });
      }
      // Anything the model skipped still needs a classification, not silent loss.
      const handledIndices = new Set(parsed.map((e) => e.index));
      unclassified.forEach((message, index) => {
        if (!handledIndices.has(index)) classified.push({ message, classification: "low_priority", source: "judgment" });
      });
    }
    await setStep(taskRunId, steps, 2, {
      status: "done",
      output: `${unclassified.length} item(s) classified by judgment`,
      completedAt: new Date().toISOString(),
    });

    // Step 4 — pipeline: flag/categorize/archive via Mail.ReadWrite per classification
    await setStep(taskRunId, steps, 3, { status: "running", startedAt: new Date().toISOString() });
    const items: TriageItem[] = [];
    for (const { message, classification, source } of classified) {
      const action = ACTION_BY_CLASSIFICATION[classification];
      const previousCategories = message.categories ?? [];
      const previousFlagStatus = message.flag?.flagStatus ?? "notFlagged";

      await graph.updateMessageTriageState(message.id, {
        flagStatus: action.flagStatus,
        categories: [...previousCategories, action.category],
      });

      let currentId = message.id;
      let wasArchived = false;
      if (action.archive) {
        const moved = await graph.moveMessage(message.id, "archive");
        currentId = moved.id;
        wasArchived = true;
      }

      const actionParts: string[] = [`categorized "${action.category}"`];
      if (action.flagStatus) actionParts.push("flagged");
      if (action.archive) actionParts.push("archived");

      items.push({
        id: currentId,
        subject: message.subject,
        from: message.from?.emailAddress?.address ?? "(unknown sender)",
        classification,
        source,
        actionTaken: actionParts.join(", "),
        undo: { currentId, originalId: message.id, wasArchived, previousCategories, previousFlagStatus },
      });
    }
    await setStep(taskRunId, steps, 3, {
      status: "done",
      output: `Applied actions to ${items.length} message(s)`,
      completedAt: new Date().toISOString(),
    });

    // Step 5 — pipeline: extract action items, and turn each into a real Task
    // (tasksTable) instead of a plain-language line that only ever lived
    // inside this one receipt's detail text. category 'communication' and
    // source 'agent' match the taxonomy taskOps.ts's own create_task tool
    // already uses; threadId links back to the real Outlook conversation.
    await setStep(taskRunId, steps, 4, { status: "running", startedAt: new Date().toISOString() });
    const needsAction = classified.filter((c) => c.classification === "urgent" || c.classification === "action_needed");
    const actionItems: TriageActionItem[] = [];
    if (needsAction.length > 0) {
      const client = getClient();
      const listing = needsAction
        .map((c) => `From: ${c.message.from?.emailAddress?.address ?? "unknown"} | Subject: ${c.message.subject} | Preview: ${c.message.bodyPreview}`)
        .join("\n");
      const response = textOf(
        await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          system: 'Extract one short, plain-language action item per email below. Reply with ONLY a JSON array of strings, same order.',
          messages: [{ role: "user", content: listing }],
        })
      );
      const parsed = parseJsonArray(response).filter((s): s is string => typeof s === "string");

      // Zipped by index against the same-order prompt above - Math.min guards
      // against the model returning a different count than requested despite
      // the instruction, rather than reading past either array's end.
      const pairCount = Math.min(parsed.length, needsAction.length);
      for (let i = 0; i < pairCount; i++) {
        const text = parsed[i];
        const source = needsAction[i];
        let taskId: number | null = null;
        try {
          const [task] = await db
            .insert(tasksTable)
            .values({
              title: text,
              description: `From triage of "${source.message.subject}" (${source.message.from?.emailAddress?.address ?? "unknown sender"})`,
              category: "communication",
              priority: source.classification === "urgent" ? "urgent" : "medium",
              source: "agent",
              threadId: source.message.conversationId,
            })
            .returning({ id: tasksTable.id });
          taskId = task?.id ?? null;
        } catch (err) {
          // A failed task insert shouldn't fail the whole triage run - the
          // classification/mailbox actions above already succeeded and are
          // real; this just means one action item has no linked Task.
          logger.warn({ err, subject: source.message.subject }, "Failed to create task for triage action item");
        }
        actionItems.push({ text, taskId, sourceMessageId: source.message.id });
      }
    }
    const tasksCreated = actionItems.filter((a) => a.taskId !== null).length;
    await setStep(taskRunId, steps, 4, {
      status: "done",
      output: `Extracted ${actionItems.length} action item(s), created ${tasksCreated} task(s)`,
      completedAt: new Date().toISOString(),
    });

    const counts: Record<TriageClassification, number> = { urgent: 0, action_needed: 0, fyi: 0, low_priority: 0 };
    for (const item of items) counts[item.classification]++;

    const previewText = actionItems.map((a) => a.text).join("\n");
    const summary = `Triaged ${items.length} unread: ${counts.urgent} urgent, ${counts.action_needed} action needed, ${counts.fyi} FYI, ${counts.low_priority} low priority`;
    await db
      .update(taskRunsTable)
      .set({ status: "completed", resultSummary: summary, previewContent: previewText, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(taskRunsTable.id, taskRunId));
    emitTaskEvent(taskRunId, { type: "done", summary, preview: previewText });

    return { taskRunId, items, actionItems, counts };
  } catch (err) {
    logger.error({ err, taskRunId }, "outlook-triage-inbox pipeline failed");
    return failRun(taskRunId, steps, err);
  }
}

/**
 * Reverses one triage action — restores prior categories/flag, moving an
 * archived message back to the inbox first. Order matters: Graph's classic
 * mail API assigns a NEW id every time a message moves folders, so if the
 * item was archived, `targetId` must be updated to the id the move-back
 * response returns before the categories/flag PATCH — using the pre-undo
 * id there would silently 404 (or worse, hit an unrelated message that
 * later reused that id).
 */
export async function undoTriageItem(entry: TriageUndoEntry): Promise<void> {
  let targetId = entry.currentId;
  if (entry.wasArchived) {
    const restored = await graph.moveMessage(entry.currentId, "inbox");
    targetId = restored.id;
  }
  await graph.updateMessageTriageState(targetId, {
    flagStatus: entry.previousFlagStatus === "flagged" ? "flagged" : "notFlagged",
    categories: entry.previousCategories,
  });
}
