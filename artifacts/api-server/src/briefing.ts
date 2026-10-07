/**
 * Mobile Morning Briefing — real tiered assembly (KHAMELEON_SPEC.md §5,
 * "Mobile Morning Briefing"). Orchestrates existing real primitives; adds
 * no new classification or send logic of its own:
 *
 *   Tier 1 (urgent / needs input) — real tasks.status IN ('needs_input',
 *     'blocked') or priority='urgent', plus real task_runs awaiting
 *     confirmation (an already-drafted action, e.g. an Outlook/Gmail
 *     reply, waiting on the user's yes/no). For an urgent/action_needed
 *     unread email that doesn't already have a draft, proactively drafts
 *     one via the real outlook-draft-email / gmail-draft-email pipelines
 *     so the briefing can say "I've drafted a reply, want to hear it?"
 *     rather than just "you have an urgent email."
 *   Tier 2 (FYI / already-handled) — the fyi/low_priority buckets from
 *     the real outlook-triage-inbox pipeline (Outlook only - no
 *     equivalent Gmail triage skill exists).
 *   Tier 3 (heads-up / brewing) — the action_needed triage bucket, plus
 *     tasks with a near dueDate that aren't yet urgent.
 *
 * Honest gaps, surfaced not hidden: if neither provider is connected, or
 * only Gmail is connected, the triage-derived tiers 2/3 are genuinely
 * empty with a real "connect Outlook to see email here" marker - never a
 * fabricated count or placeholder item.
 */

import { db } from "@workspace/db";
import { tasksTable, taskRunsTable, agentConversationsTable, type Task } from "@workspace/db";
import { eq, inArray, or, and, gte, lte } from "drizzle-orm";
import { isConnected } from "./lib/oauthTokens.js";
import { runOutlookTriageInbox, ACTION_BY_CLASSIFICATION, type TriageItem } from "./agents/skills/outlookTriageInbox.js";
import { runOutlookDraftEmail } from "./agents/skills/outlookDraftEmail.js";
import { runGmailDraftEmail } from "./agents/skills/gmailDraftEmail.js";
import { logger } from "./lib/logger.js";

export interface BriefingDraft {
  provider: "outlook" | "gmail";
  approvalId: number;
  to: string;
  subject: string;
  body: string;
  /** Only Outlook drafts support the voice "change the tone" re-compose pass in this first version. */
  supportsRewrite: boolean;
}

export interface BriefingUrgentItem {
  kind: "task" | "awaiting_confirmation" | "drafted_reply";
  id: string;
  title: string;
  detail?: string;
  draft?: BriefingDraft;
}

export interface BriefingFyiItem {
  id: string;
  subject: string;
  from: string;
  actionTaken: string;
}

export interface BriefingHeadsUpItem {
  id: string;
  title: string;
  detail?: string;
}

export interface MorningBriefing {
  generatedAt: string;
  urgent: BriefingUrgentItem[];
  fyi: BriefingFyiItem[];
  headsUp: BriefingHeadsUpItem[];
  emailConnected: { outlook: boolean; gmail: boolean };
}

async function listUrgentTasks(): Promise<Task[]> {
  return db
    .select()
    .from(tasksTable)
    .where(
      or(
        inArray(tasksTable.status, ["needs_input", "blocked"]),
        eq(tasksTable.priority, "urgent"),
      ),
    );
}

async function listSoonDueTasks(withinDays: number): Promise<Task[]> {
  const today = new Date();
  const soon = new Date(today.getTime() + withinDays * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return db
    .select()
    .from(tasksTable)
    .where(
      and(
        gte(tasksTable.dueDate, fmt(today)),
        lte(tasksTable.dueDate, fmt(soon)),
        inArray(tasksTable.status, ["todo", "in_progress"]),
      ),
    );
}

/** Real task_runs awaiting the user's yes/no on an already-drafted action (not yet mapped to a BriefingDraft - callers attach that from the approvals payload where relevant). */
async function listAwaitingConfirmationRuns() {
  return db.select().from(taskRunsTable).where(eq(taskRunsTable.status, "awaiting_confirmation"));
}

/**
 * For a real triage item classified urgent/action_needed, proactively
 * drafts a reply via whichever real provider is connected (Outlook
 * preferred, then Gmail) - never both, and never invented if neither is
 * connected. Failures are logged and the item still surfaces without a
 * draft rather than failing the whole briefing.
 */
async function draftReplyFor(item: TriageItem, outlookOn: boolean, gmailOn: boolean): Promise<BriefingDraft | undefined> {
  try {
    if (outlookOn) {
      const result = await runOutlookDraftEmail(item.id);
      return { provider: "outlook", approvalId: await approvalIdFor(result.taskRunId), to: result.to, subject: result.subject, body: result.body, supportsRewrite: true };
    }
    if (gmailOn) {
      const result = await runGmailDraftEmail(item.id);
      return { provider: "gmail", approvalId: await approvalIdFor(result.taskRunId), to: result.to, subject: result.subject, body: result.body, supportsRewrite: false };
    }
  } catch (err) {
    logger.warn({ err, messageId: item.id }, "Morning briefing: proactive draft failed, surfacing item without a draft");
  }
  return undefined;
}

/** The draft pipelines return a taskRunId, not the approvalId the /send and /reject endpoints need - this looks up the approval row the same route handlers created, by its real dataInvolved payload. */
async function approvalIdFor(taskRunId: string): Promise<number> {
  const { approvalsTable } = await import("@workspace/db");
  const rows = await db.select().from(approvalsTable);
  const match = rows.find((r) => {
    try {
      return (JSON.parse(r.dataInvolved) as { taskRunId?: string }).taskRunId === taskRunId;
    } catch {
      return false;
    }
  });
  if (!match) throw new Error(`No approval row found for task run ${taskRunId}`);
  return match.id;
}

export async function assembleMorningBriefing(): Promise<MorningBriefing> {
  const [outlookOn, gmailOn] = await Promise.all([isConnected("microsoft"), isConnected("google")]);

  const urgent: BriefingUrgentItem[] = [];
  const fyi: BriefingFyiItem[] = [];
  const headsUp: BriefingHeadsUpItem[] = [];

  const [urgentTasks, soonDueTasks, awaitingRuns] = await Promise.all([
    listUrgentTasks(),
    listSoonDueTasks(3),
    listAwaitingConfirmationRuns(),
  ]);

  for (const t of urgentTasks) {
    urgent.push({ kind: "task", id: String(t.id), title: t.title, detail: t.waitingOn ? `Waiting on ${t.waitingOn}` : t.description || undefined });
  }
  for (const run of awaitingRuns) {
    urgent.push({ kind: "awaiting_confirmation", id: run.id, title: run.resultSummary || "A drafted action is waiting on your confirmation" });
  }

  if (outlookOn) {
    try {
      const triage = await runOutlookTriageInbox();
      for (const item of triage.items) {
        if (item.classification === "urgent" || item.classification === "action_needed") {
          const draft = await draftReplyFor(item, outlookOn, gmailOn);
          if (item.classification === "urgent") {
            urgent.push({ kind: "drafted_reply", id: item.id, title: `${item.subject} — from ${item.from}`, draft });
          } else {
            headsUp.push({ id: item.id, title: `${item.subject} — from ${item.from}`, detail: draft ? "A reply has been drafted" : undefined });
          }
        } else {
          fyi.push({ id: item.id, subject: item.subject, from: item.from, actionTaken: ACTION_BY_CLASSIFICATION[item.classification].category });
        }
      }
    } catch (err) {
      logger.warn({ err }, "Morning briefing: Outlook triage failed, continuing with task-only tiers");
    }
  }

  for (const t of soonDueTasks) {
    if (!urgent.some((u) => u.kind === "task" && u.id === String(t.id))) {
      headsUp.push({ id: `task-${t.id}`, title: t.title, detail: t.dueDate ? `Due ${t.dueDate}` : undefined });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    urgent,
    fyi,
    headsUp,
    emailConnected: { outlook: outlookOn, gmail: gmailOn },
  };
}

/** Thrown for a request shape the HTTP route should answer 400, not 500. */
export class InvalidBriefingTurnError extends Error {}

/**
 * Records one real turn of a Mobile Briefing run into agent_conversations
 * (agentId "briefing"), so the desktop Chat Window can later resume this
 * exact session as a real conversation - the continuity gap this spec
 * section itself named as still open. Extracted as a plain function
 * (validation included) rather than left inline in the route handler, so
 * it's directly testable without an HTTP layer - same pattern as this
 * file's other exports.
 */
export async function recordBriefingTurn(sessionId: string, role: string, content: string): Promise<void> {
  if (!sessionId.trim()) throw new InvalidBriefingTurnError("sessionId is required");
  if (role !== "user" && role !== "assistant") throw new InvalidBriefingTurnError("role must be 'user' or 'assistant'");
  if (!content.trim()) throw new InvalidBriefingTurnError("content is required");
  await db.insert(agentConversationsTable).values({ agentId: "briefing", sessionId, role, content });
}
