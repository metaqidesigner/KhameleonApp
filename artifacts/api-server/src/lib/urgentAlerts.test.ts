import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanSettings, inQuietHours, isCandidate, alertFor } from "./urgentAlerts.js";
import { parseJudgment, describeInbox, type Classified, type InboxMessage } from "./inboxTriage.js";
import { gmailActionsFor } from "../agents/skills/gmailTriageInbox.js";
import { ownToolsFor } from "../agents/tools/anyAiTools.js";

const msg = (over: Partial<InboxMessage>): InboxMessage => ({ id: "m1", source: "gmail", threadId: "t", from: "jane@acme.com", fromName: "Jane Smith", subject: "Payment run fails today", preview: "The bank file was rejected", receivedAt: "2026-10-19T09:00:00Z", important: false, ...over });

test("settings stay sensible: 3 a day and 7pm-8am quiet hours by default", () => {
  assert.deepEqual(cleanSettings({}), { mode: "regular", maxPerDay: 3, quietStart: 19, quietEnd: 8 });
  assert.equal(cleanSettings({ maxPerDay: 99 }).maxPerDay, 10);
  assert.equal(cleanSettings({ mode: "push" as never }).mode, "regular");
});

test("quiet hours, including past midnight", () => {
  assert.ok(inQuietHours(new Date(2026, 9, 19, 21), 19, 8));
  assert.ok(inQuietHours(new Date(2026, 9, 19, 6), 19, 8));
  assert.ok(!inQuietHours(new Date(2026, 9, 19, 10), 19, 8));
  assert.ok(inQuietHours(new Date(2026, 9, 19, 13), 12, 14));
});

test("only mail from people you write to, or marked important, is considered", () => {
  const people = new Set(["jane@acme.com"]);
  assert.ok(isCandidate(msg({}), people));
  assert.ok(isCandidate(msg({ from: "ceo@acme.com", important: true }), people));
  assert.ok(!isCandidate(msg({ from: "stranger@example.com" }), people));
});

test("flags say why, and several are grouped into one", () => {
  const people = new Set(["jane@acme.com"]);
  const c: Classified = { message: msg({}), classification: "urgent", source: "judgment", why: "Khami judged it needs attention today" };
  const one = alertFor([c], people);
  assert.equal(one.title, "Urgent: Payment run fails today");
  assert.match(one.why, /From Jane Smith \(someone you write to - Khami judged/);
  const two = alertFor([c, { ...c, message: msg({ id: "m2", from: "ceo@acme.com", fromName: "Pat", important: true, subject: "Board pack" }) }], people);
  assert.equal(two.title, "2 urgent emails");
  assert.match(two.body, /Board pack - from Pat \(marked important/);
});

test("inbox answers for the chat, and Khami's judgment is read safely", () => {
  assert.deepEqual(parseJudgment('[{"index":0,"classification":"urgent"},{"index":5,"classification":"fyi"},{"index":1,"classification":"maybe"}]', 2), ["urgent", null]);
  const text = describeInbox([{ message: msg({}), classification: "urgent", source: "rule", why: "the subject says it's urgent" }]);
  assert.match(text, /Unread: 1 - 1 urgent/);
  assert.match(text, /Payment run fails today - from Jane Smith/);
  assert.match(text, /Nothing has been moved/);
  assert.equal(describeInbox([]), "No unread email in the inbox.");
});

test("Gmail sort: urgent starred, FYI and low priority archived", () => {
  assert.deepEqual(gmailActionsFor("urgent"), { star: true, archive: false });
  assert.deepEqual(gmailActionsFor("fyi"), { star: false, archive: true });
  assert.deepEqual(gmailActionsFor("action_needed"), { star: false, archive: false });
});

test("the chat gets the inbox tool for inbox questions, not for writing email", () => {
  assert.ok(ownToolsFor("Anything urgent in my inbox?").includes("check_inbox"));
  assert.ok(ownToolsFor("Do I need to reply to anything?").includes("check_inbox"));
  assert.ok(!ownToolsFor("Draft an email to Jane").includes("check_inbox"));
});
