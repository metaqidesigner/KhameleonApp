/**
 * Unit tests for outlookTriageInbox.ts's pure classification rule and
 * action mapping. The pipeline itself needs a DB connection, a live
 * Microsoft token, live network, and an Anthropic key — same DB-free/
 * network-free testing boundary as the other outlook skill test files.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyByRule, ACTION_BY_CLASSIFICATION } from "./outlookTriageInbox.js";

function msg(subject: string, fromAddress: string) {
  return { subject, from: { emailAddress: { address: fromAddress } } };
}

test("classifyByRule flags urgent-language subjects", () => {
  assert.equal(classifyByRule(msg("URGENT: server down", "ops@example.com")), "urgent");
  assert.equal(classifyByRule(msg("Action required ASAP", "ops@example.com")), "urgent");
  assert.equal(classifyByRule(msg("Time-sensitive: contract expires today", "legal@example.com")), "urgent");
});

test("classifyByRule treats automated senders as fyi regardless of subject", () => {
  assert.equal(classifyByRule(msg("Your weekly digest", "no-reply@newsletter.com")), "fyi");
  assert.equal(classifyByRule(msg("Build passed", "notifications@ci.example.com")), "fyi");
});

test("classifyByRule treats an explicit FYI/Fwd subject prefix as fyi", () => {
  assert.equal(classifyByRule(msg("FYI: office closed Monday", "alice@example.com")), "fyi");
  assert.equal(classifyByRule(msg("Fwd: see below", "alice@example.com")), "fyi");
});

test("classifyByRule detects requests for review/approval/a question as action_needed", () => {
  assert.equal(classifyByRule(msg("Please review the attached proposal", "bob@example.com")), "action_needed");
  assert.equal(classifyByRule(msg("Can you approve this expense?", "bob@example.com")), "action_needed");
  assert.equal(classifyByRule(msg("Are we still on for Thursday?", "bob@example.com")), "action_needed");
});

test("classifyByRule returns null (needs judgment) for ordinary subjects", () => {
  assert.equal(classifyByRule(msg("Notes from today", "carol@example.com")), null);
  assert.equal(classifyByRule(msg("Lunch?", "carol@example.com")), "action_needed"); // question mark still matches
});

test("classifyByRule prioritizes urgent over automated-sender/fyi signals", () => {
  // An urgent subject from an automated address should still surface as urgent, not get buried as fyi.
  assert.equal(classifyByRule(msg("URGENT: action required", "no-reply@alerts.example.com")), "urgent");
});

test("ACTION_BY_CLASSIFICATION maps every classification to a real action", () => {
  assert.equal(ACTION_BY_CLASSIFICATION.urgent.flagStatus, "flagged");
  assert.equal(ACTION_BY_CLASSIFICATION.urgent.category, "Urgent");
  assert.equal(ACTION_BY_CLASSIFICATION.action_needed.archive, undefined);
  assert.equal(ACTION_BY_CLASSIFICATION.fyi.archive, true);
  assert.equal(ACTION_BY_CLASSIFICATION.low_priority.archive, true);
});
