/**
 * Unit tests for the tool-call rate limiter (dispatcher.ts's guard).
 * Run with: pnpm --filter @workspace/api-server run test
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { checkToolRateLimit, __resetRateLimiterForTests } from "./rateLimiter.js";

beforeEach(() => __resetRateLimiterForTests());

test("checkToolRateLimit allows calls under the standard-tier limit", () => {
  for (let i = 0; i < 5; i++) {
    assert.doesNotThrow(() => checkToolRateLimit("read_file"));
  }
});

test("checkToolRateLimit throws once the write tier's limit is exceeded", () => {
  const toolName = "write_file";
  // The limiter is 20/5min for write-tier tools - exhaust it, then confirm
  // the next call throws with a clear, actionable message.
  for (let i = 0; i < 20; i++) {
    checkToolRateLimit(toolName);
  }
  assert.throws(() => checkToolRateLimit(toolName), /Rate limit exceeded/);
});

test("write-tier and standard-tier limits are independent counters", () => {
  // Exhausting run_command's write-tier budget must not affect a
  // read-only tool's separate, much larger standard-tier budget.
  for (let i = 0; i < 20; i++) {
    checkToolRateLimit("run_command");
  }
  assert.throws(() => checkToolRateLimit("run_command"));
  assert.doesNotThrow(() => checkToolRateLimit("list_files"));
});
