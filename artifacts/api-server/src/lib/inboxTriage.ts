/**
 * Inbox sorting for any mailbox (Build 11): the same classification the
 * Outlook sort uses - rules first, Khami's judgment only for what's left -
 * shared by the chat's read-only inbox tool, the Gmail sort, and urgent
 * alerts. Pure parts are exported for tests.
 */
import { isConnected } from "./oauthTokens.js";
import * as outlook from "./outlookGraph.js";
import * as gmail from "./gmailApi.js";
import { classifyByRule, type TriageClassification } from "../agents/skills/outlookTriageInbox.js";
import { askAI } from "./askAI.js";
import { splitSender } from "./emailAssist.js";

export interface InboxMessage {
  id: string;
  source: "outlook" | "gmail";
  threadId: string;
  from: string; // address
  fromName: string;
  subject: string;
  preview: string;
  receivedAt: string;
  /** Marked important by the sender or the mail service. */
  important: boolean;
  labelIds?: string[];
}
export interface Classified { message: InboxMessage; classification: TriageClassification; source: "rule" | "judgment"; why: string }

export async function listUnread(): Promise<InboxMessage[]> {
  const out: InboxMessage[] = [];
  if (await isConnected("microsoft").catch(() => false)) {
    for (const m of await outlook.listUnreadInboxMessages(50)) {
      out.push({ id: m.id, source: "outlook", threadId: m.conversationId, from: (m.from?.emailAddress?.address ?? "").toLowerCase(), fromName: m.from?.emailAddress?.name ?? "",
        subject: m.subject ?? "", preview: outlook.stripHtml(m.bodyPreview ?? ""), receivedAt: m.receivedDateTime, important: m.importance === "high" || m.flag?.flagStatus === "flagged" });
    }
  }
  if (await isConnected("google").catch(() => false)) {
    for (const m of await gmail.listUnreadInbox(50)) {
      const s = splitSender(m.from);
      out.push({ id: m.id, source: "gmail", threadId: m.threadId, from: s.address, fromName: s.name, subject: m.subject, preview: m.preview,
        receivedAt: new Date(Number(m.internalDate)).toISOString(), important: m.labelIds.includes("IMPORTANT") || m.labelIds.includes("STARRED"), labelIds: m.labelIds });
    }
  }
  return out;
}

const RULE_WHY: Record<TriageClassification, string> = {
  urgent: "the subject says it's urgent",
  action_needed: "it asks you for something",
  fyi: "it's a newsletter, notification or forwarded FYI",
  low_priority: "it can wait",
};

export function parseJudgment(reply: string, count: number): (TriageClassification | null)[] {
  const out: (TriageClassification | null)[] = Array(count).fill(null);
  const m = reply.match(/\[[\s\S]*\]/);
  if (!m) return out;
  try {
    for (const e of JSON.parse(m[0]) as { index?: number; classification?: string }[]) {
      if (typeof e.index === "number" && e.index >= 0 && e.index < count && ["urgent", "action_needed", "fyi", "low_priority"].includes(e.classification ?? "")) out[e.index] = e.classification as TriageClassification;
    }
  } catch { /* unreadable - treated as unclassified */ }
  return out;
}

/** Rules first; Khami (on this computer) judges the rest in one request. */
export async function classifyMessages(messages: InboxMessage[]): Promise<Classified[]> {
  const out: Classified[] = [];
  const rest: InboxMessage[] = [];
  for (const m of messages) {
    const rule = classifyByRule({ subject: m.subject, from: { emailAddress: { name: m.fromName, address: m.from } } });
    if (rule) out.push({ message: m, classification: rule, source: "rule", why: RULE_WHY[rule] });
    else rest.push(m);
  }
  if (rest.length) {
    let judged: (TriageClassification | null)[] = Array(rest.length).fill(null);
    try {
      const reply = await askAI({
        system: [
          "Classify each numbered email into exactly one of: urgent, action_needed, fyi, low_priority.",
          "urgent = needs attention very soon (today). action_needed = a decision or reply is expected, not urgent.",
          "fyi = informational, no action expected. low_priority = safe to defer or ignore.",
          'Reply with ONLY a JSON array like [{"index": 0, "classification": "fyi"}, ...] - one entry per email.',
        ].join("\n"),
        prompt: rest.map((m, i) => `${i}. From: ${m.fromName || m.from} | Subject: ${m.subject} | Preview: ${m.preview.slice(0, 200)}`).join("\n"),
      });
      judged = parseJudgment(reply.text, rest.length);
    } catch { /* no AI - everything left counts as needing a look */ }
    rest.forEach((m, i) => {
      const c = judged[i] ?? "action_needed";
      out.push({ message: m, classification: c, source: "judgment", why: judged[i] ? (c === "urgent" ? "Khami judged it needs attention today" : `Khami judged it ${c === "action_needed" ? "needs a reply or decision" : c === "fyi" ? "is for information" : "can wait"}`) : "couldn't be judged, so it's worth a look" });
    });
  }
  return out;
}

const LABEL: Record<TriageClassification, string> = { urgent: "Urgent", action_needed: "Needs action", fyi: "FYI", low_priority: "Low priority" };

/** The chat's read-only answer. Pure. */
export function describeInbox(items: Classified[], focus?: string): string {
  if (!items.length) return "No unread email in the inbox.";
  const counts = { urgent: 0, action_needed: 0, fyi: 0, low_priority: 0 } as Record<TriageClassification, number>;
  for (const i of items) counts[i.classification]++;
  const list = (c: TriageClassification) => items.filter(i => i.classification === c).slice(0, 8)
    .map(i => `- ${i.message.subject} - from ${i.message.fromName || i.message.from} (${i.why})`);
  const urgentOnly = /urgent/i.test(focus ?? "");
  return [
    `Unread: ${items.length} - ${counts.urgent} urgent, ${counts.action_needed} needing action, ${counts.fyi} FYI, ${counts.low_priority} low priority.`,
    counts.urgent ? `Urgent:\n${list("urgent").join("\n")}` : "Nothing urgent.",
    !urgentOnly && counts.action_needed ? `Needing action:\n${list("action_needed").join("\n")}` : "",
    "(Nothing has been moved - say \"sort my inbox\" to flag and file them.)",
  ].filter(Boolean).join("\n\n");
}
export { LABEL as CLASSIFICATION_LABEL };
