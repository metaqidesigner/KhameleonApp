/**
 * Gmail version of inbox sorting (docs/build-review.md, Build 11): the same
 * classification as Outlook's (lib/inboxTriage.ts). Gmail has labels, not
 * categories: each email gets a "Khameleon/…" label; urgent ones are
 * starred; FYI and low priority are archived (taken out of the inbox).
 * Everything can be undone. Action items become tasks, as for Outlook.
 */
import { db, tasksTable, actionReceiptsTable } from "@workspace/db";
import * as gmail from "../../lib/gmailApi.js";
import { listUnread, classifyMessages, CLASSIFICATION_LABEL } from "../../lib/inboxTriage.js";
import { askAI } from "../../lib/askAI.js";
import { logger } from "../../lib/logger.js";
import type { TriageClassification } from "./outlookTriageInbox.js";

export interface GmailUndoEntry { id: string; addedLabels: string[]; removedLabels: string[] }
export interface GmailTriageItem { id: string; subject: string; from: string; classification: TriageClassification; source: "rule" | "judgment"; actionTaken: string; undo: GmailUndoEntry }

/** What each classification does in Gmail. Pure. */
export function gmailActionsFor(c: TriageClassification): { star: boolean; archive: boolean } {
  return { star: c === "urgent", archive: c === "fyi" || c === "low_priority" };
}

export async function runGmailTriageInbox() {
  const unread = (await listUnread()).filter(m => m.source === "gmail");
  const classified = await classifyMessages(unread);
  const labelIds: Partial<Record<TriageClassification, string>> = {};
  const items: GmailTriageItem[] = [];
  for (const c of classified) {
    labelIds[c.classification] ??= await gmail.ensureLabel(`Khameleon/${CLASSIFICATION_LABEL[c.classification]}`);
    const act = gmailActionsFor(c.classification);
    const add = [labelIds[c.classification]!, ...(act.star && !c.message.labelIds?.includes("STARRED") ? ["STARRED"] : [])];
    const remove = act.archive ? ["INBOX"] : [];
    await gmail.modifyLabels(c.message.id, add, remove);
    items.push({
      id: c.message.id, subject: c.message.subject, from: c.message.from, classification: c.classification, source: c.source,
      actionTaken: [`labelled "${CLASSIFICATION_LABEL[c.classification]}"`, act.star ? "starred" : "", act.archive ? "archived" : ""].filter(Boolean).join(", "),
      undo: { id: c.message.id, addedLabels: add, removedLabels: remove },
    });
  }

  const needsAction = classified.filter(c => c.classification === "urgent" || c.classification === "action_needed");
  const actionItems: { text: string; taskId: number | null; sourceMessageId: string }[] = [];
  if (needsAction.length) {
    try {
      const reply = await askAI({
        system: "Extract one short, plain-language action item per email below. Reply with ONLY a JSON array of strings, same order.",
        prompt: needsAction.map(c => `From: ${c.message.from} | Subject: ${c.message.subject} | Preview: ${c.message.preview.slice(0, 200)}`).join("\n"),
      });
      const parsed = (() => { try { const m = reply.text.match(/\[[\s\S]*\]/); return m ? (JSON.parse(m[0]) as unknown[]).filter((s): s is string => typeof s === "string") : []; } catch { return []; } })();
      for (let i = 0; i < Math.min(parsed.length, needsAction.length); i++) {
        const src = needsAction[i];
        let taskId: number | null = null;
        try {
          const [t] = await db.insert(tasksTable).values({
            title: parsed[i], description: `From sorting "${src.message.subject}" (${src.message.from})`, category: "communication",
            priority: src.classification === "urgent" ? "urgent" : "medium", source: "agent", threadId: src.message.threadId,
          }).returning({ id: tasksTable.id });
          taskId = t?.id ?? null;
        } catch (err) { logger.warn({ err }, "Couldn't create a task from a Gmail sort"); }
        actionItems.push({ text: parsed[i], taskId, sourceMessageId: src.message.id });
      }
    } catch (err) { logger.warn({ err }, "Action items skipped for the Gmail sort"); }
  }

  const counts: Record<TriageClassification, number> = { urgent: 0, action_needed: 0, fyi: 0, low_priority: 0 };
  for (const i of items) counts[i.classification]++;
  await db.insert(actionReceiptsTable).values({
    description: `Sorted ${items.length} Gmail email${items.length === 1 ? "" : "s"}`, category: "inbox_sorted", scope: "gmail.modify", outcome: "success", target: "Gmail", canUndo: false,
  }).catch(() => undefined);
  return { items, actionItems, counts };
}

export async function undoGmailTriageItem(e: GmailUndoEntry): Promise<void> {
  await gmail.modifyLabels(e.id, e.removedLabels, e.addedLabels);
}
