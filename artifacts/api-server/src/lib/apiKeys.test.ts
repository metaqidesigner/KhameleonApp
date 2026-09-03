/**
 * Unit tests for apiKeys.ts's input-validation logic — the parts that reject
 * bad input *before* touching the database, so they're testable without a
 * real Postgres connection. Saving/reading a real key needs the DB and
 * isn't covered here — same DB-free-only-what's-possible pattern as
 * weather.test.ts and webFetch.test.ts.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { setApiKey, clearApiKey, API_KEY_PROVIDERS } from "./apiKeys.js";

test("API_KEY_PROVIDERS lists exactly the five supported model providers", () => {
  assert.deepEqual(
    [...API_KEY_PROVIDERS].sort(),
    ["anthropic", "google", "minimax", "openai", "openrouter"],
  );
});

test("setApiKey rejects an unknown provider before touching the database", async () => {
  await assert.rejects(() => setApiKey("not-a-real-provider", "sk-something"), /Unknown API key provider/);
});

test("setApiKey rejects an empty key", async () => {
  await assert.rejects(() => setApiKey("anthropic", ""), /cannot be empty/);
});

test("setApiKey rejects a whitespace-only key", async () => {
  await assert.rejects(() => setApiKey("anthropic", "   "), /cannot be empty/);
});

test("clearApiKey rejects an unknown provider before touching the database", async () => {
  await assert.rejects(() => clearApiKey("not-a-real-provider"), /Unknown API key provider/);
});
