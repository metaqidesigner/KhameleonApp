import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSuggestionRequest, parseSuggestionResponse } from "./skillSetSuggestionMatch.js";

const TASK = { title: "Draft this week's status update", description: "For the leadership sync tomorrow" };
const CANDIDATES = [
  { id: 1, name: "Weekly Status Update Drafting", description: "Guides drafting a weekly status update." },
  { id: 2, name: "Meeting Prep Briefing", description: "Builds a pre-meeting briefing." },
];

test("buildSuggestionRequest: no candidates -> null, nothing to match against", () => {
  assert.equal(buildSuggestionRequest(TASK, []), null);
});

test("buildSuggestionRequest: includes the task and every candidate id/name in the prompt", () => {
  const req = buildSuggestionRequest(TASK, CANDIDATES);
  assert.ok(req);
  assert.match(req!.userMessage, /Draft this week's status update/);
  assert.match(req!.userMessage, /id 1: "Weekly Status Update Drafting"/);
  assert.match(req!.userMessage, /id 2: "Meeting Prep Briefing"/);
  assert.match(req!.system, /NONE/);
  assert.match(req!.system, /never invent an id/i);
});

test("parseSuggestionResponse: NONE -> null", () => {
  assert.equal(parseSuggestionResponse("NONE", [1, 2]), null);
  assert.equal(parseSuggestionResponse("  none\n", [1, 2]), null);
});

test("parseSuggestionResponse: a well-formed match parses correctly", () => {
  const result = parseSuggestionResponse("1|Matches the weekly status update pattern exactly", [1, 2]);
  assert.deepEqual(result, { skillSetId: 1, reason: "Matches the weekly status update pattern exactly" });
});

test("parseSuggestionResponse: an id outside validIds is treated as no match, not an error", () => {
  assert.equal(parseSuggestionResponse("99|Some reason", [1, 2]), null);
});

test("parseSuggestionResponse: garbage/unparseable text -> null", () => {
  assert.equal(parseSuggestionResponse("I think maybe skill set 1 could work", [1, 2]), null);
  assert.equal(parseSuggestionResponse("", [1, 2]), null);
});

test("parseSuggestionResponse: an empty reason after the pipe -> null rather than a blank suggestion", () => {
  assert.equal(parseSuggestionResponse("1|   ", [1, 2]), null);
});

test("parseSuggestionResponse: a very long reason is truncated, not rejected", () => {
  const longReason = "x".repeat(500);
  const result = parseSuggestionResponse(`1|${longReason}`, [1, 2]);
  assert.ok(result);
  assert.equal(result!.reason.length, 200);
});
