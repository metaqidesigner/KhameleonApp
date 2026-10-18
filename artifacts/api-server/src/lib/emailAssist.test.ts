import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseSubject, subjectMatches, looksLikeAPerson, splitSender, parseAssist, assistPrompt, rewritePrompt } from "./emailAssist.js";

test("matches the subject in a window title to the message, ignoring RE:/FW: and cut-off titles", () => {
  assert.equal(normaliseSubject("RE: Fwd:  Q3 figures "), "q3 figures");
  assert.ok(subjectMatches("Re: Q3 figures", "Q3 figures"));
  assert.ok(subjectMatches("Supplier statement for Septem…", "Supplier statement for September 2026"));
  assert.ok(!subjectMatches("Q3", "Q3 figures for the board"), "too short to count as a cut-off title");
  assert.ok(!subjectMatches("Lunch on Friday", "Q3 figures"));
});

test("tells real people from newsletters and notifications", () => {
  assert.ok(looksLikeAPerson("Jane Smith <jane.smith@acme.co.uk>"));
  assert.ok(looksLikeAPerson("bob@supplier.com"));
  assert.ok(!looksLikeAPerson("Acme <no-reply@acme.com>"));
  assert.ok(!looksLikeAPerson("notifications@github.com"));
  assert.ok(!looksLikeAPerson("Deals <offers@acme.com>"));
  assert.ok(!looksLikeAPerson("Acme News <hi@news.acme.com>"));
  assert.ok(!looksLikeAPerson("jane@acme.com", { gmailLabels: ["INBOX", "CATEGORY_PROMOTIONS"] }));
  assert.ok(!looksLikeAPerson(""));
  assert.deepEqual(splitSender('"Smith, Jane" <Jane@Acme.com>'), { name: "Smith, Jane", address: "jane@acme.com" });
});

test("reads Khami's answer into summary, reply and up to three actions", () => {
  const r = parseAssist([
    "**SUMMARY:** Jane needs the Q3 figures by Friday.",
    "REPLY:",
    "Hi Jane,",
    "",
    "I'll send the Q3 figures by Friday.",
    "",
    "Thanks,",
    "ACTIONS:",
    "- TASK: Send Jane the Q3 figures",
    "- CALENDAR: Q3 figures due Friday",
    "- NOTE: Copy in finance",
    "- TASK: An extra one that should be dropped",
  ].join("\n"));
  assert.equal(r.summary, "Jane needs the Q3 figures by Friday.");
  assert.equal(r.reply, "Hi Jane,\n\nI'll send the Q3 figures by Friday.\n\nThanks,");
  assert.deepEqual(r.actions, [
    { kind: "task", label: "Send Jane the Q3 figures" },
    { kind: "calendar", label: "Q3 figures due Friday" },
    { kind: "other", label: "Copy in finance" },
  ]);
});

test("handles 'no reply needed', empty action lists and unformatted answers", () => {
  const r = parseAssist("SUMMARY: A newsletter.\nREPLY:\nNO REPLY NEEDED\nACTIONS:\n- TASK: <something I need to do, if any>\n- none");
  assert.equal(r.reply, "");
  assert.deepEqual(r.actions, []);
  const loose = parseAssist("Sure - here's a reply: Thanks, will do.");
  assert.equal(loose.reply, "Sure - here's a reply: Thanks, will do.");
});

test("prompts include the email, cut long bodies, and never ask to send", () => {
  const p = assistPrompt({ subject: "Q3", from: "jane@acme.com", body: "x".repeat(5000) });
  assert.match(p, /Subject: Q3/);
  assert.match(p, /cut for length/);
  assert.match(rewritePrompt({ subject: "Q3", from: "a@b.com", body: "hi" }, "Thanks", "shorter"), /shorter/);
  assert.doesNotMatch(p + rewritePrompt({ subject: "Q3", from: "a@b.com", body: "hi" }, "Thanks", "more-formal"), /\bsend it\b/i);
});
