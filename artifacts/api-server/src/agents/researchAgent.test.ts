/**
 * Unit test for researchAgent.ts's one pure helper. The research loop
 * itself needs a live Anthropic key and (with web_search on) live network -
 * same DB-free/network-free testing boundary as the other agent/skill test
 * files this session.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { clampIterations } from "./researchAgent.js";

test("clampIterations passes through a valid value", () => {
  assert.equal(clampIterations(5), 5);
});

test("clampIterations clamps below the minimum up to 1", () => {
  assert.equal(clampIterations(0), 1);
  assert.equal(clampIterations(-3), 1);
});

test("clampIterations clamps above the maximum down to 10", () => {
  assert.equal(clampIterations(999), 10);
});

test("clampIterations rounds a fractional value", () => {
  assert.equal(clampIterations(3.7), 4);
});

test("clampIterations falls back to the default for non-numeric input", () => {
  assert.equal(clampIterations(undefined), 3);
  assert.equal(clampIterations("not a number"), 3);
  assert.equal(clampIterations(null), 3);
});

test("clampIterations honors a custom fallback", () => {
  assert.equal(clampIterations(undefined, 5), 5);
});
