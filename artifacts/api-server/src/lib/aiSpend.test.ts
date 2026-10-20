import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCost, pricesFor, monthKey, totalOf, PAY_PER_USE, limitReachedMessage } from "./aiSpend.js";

test("costs an answer from question and answer sizes at the model's prices", () => {
  // Claude Sonnet: US$3 per million in, US$15 per million out.
  assert.equal(estimateCost("claude-sonnet-4-6", 1_000_000, 0), 3);
  assert.equal(estimateCost("claude-sonnet-4-6", 0, 1_000_000), 15);
  assert.ok(Math.abs(estimateCost("claude-sonnet-4-6", 2000, 500) - 0.0135) < 1e-9);
  assert.equal(estimateCost("gpt-4o-mini", -5, -5), 0);
});

test("unknown models (e.g. a company's own Azure deployment) are priced mid-range, erring high", () => {
  assert.deepEqual(pricesFor("acme-gpt-deployment"), [3, 15]);
  assert.deepEqual(pricesFor("gpt-4o-2024-08-06"), pricesFor("gpt-4o"));
});

test("only pay-per-use AIs count; Khami and Copilot don't", () => {
  assert.ok(PAY_PER_USE.has("anthropic") && PAY_PER_USE.has("azure"));
  assert.ok(!PAY_PER_USE.has("khami") && !PAY_PER_USE.has("copilot"));
});

test("kept per month, totalled across AIs, with a plain limit message", () => {
  assert.equal(monthKey(new Date(2026, 9, 20)), "ai_spend:2026-10");
  assert.equal(totalOf({ anthropic: { usd: 1.5, answers: 3 }, openai: { usd: 0.25, answers: 1 } }), 1.75);
  assert.match(limitReachedMessage(20), /US\$20\.00.*Khami/);
});
