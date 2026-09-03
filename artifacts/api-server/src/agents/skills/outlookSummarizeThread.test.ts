/**
 * Unit test for outlookSummarizeThread.ts's one pure helper. The pipeline
 * itself needs a DB connection, a live Microsoft token, and live network -
 * same DB-free/network-free testing boundary as outlookGraph.test.ts.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { distinctParticipants } from "./outlookSummarizeThread.js";

test("distinctParticipants dedupes senders, preserving first-seen order", () => {
  const result = distinctParticipants([
    { from: { emailAddress: { address: "alice@example.com" } } },
    { from: { emailAddress: { address: "bob@example.com" } } },
    { from: { emailAddress: { address: "alice@example.com" } } },
  ]);
  assert.deepEqual(result, ["alice@example.com", "bob@example.com"]);
});

test("distinctParticipants skips messages with no sender", () => {
  const result = distinctParticipants([
    { from: null },
    { from: { emailAddress: { address: "alice@example.com" } } },
  ]);
  assert.deepEqual(result, ["alice@example.com"]);
});

test("distinctParticipants returns an empty array for an empty thread", () => {
  assert.deepEqual(distinctParticipants([]), []);
});
