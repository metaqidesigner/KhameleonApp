/**
 * Unit tests for accounts.ts's password hashing (pure, DB-free) and
 * createUser's pre-DB validation (email format, password length) - same
 * "rejects before touching the database" pattern as apiKeys.test.ts.
 * Importing this module still requires DATABASE_URL to be set, same as
 * every other test file that imports anything from @workspace/db, even
 * when the specific assertions here never issue a query.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { encodePasswordHash, verifyPasswordHash, createUser } from "./accounts.js";

test("encodePasswordHash round-trips: the same password verifies against its own hash", () => {
  const encoded = encodePasswordHash("correct horse battery staple");
  assert.equal(verifyPasswordHash("correct horse battery staple", encoded), true);
});

test("verifyPasswordHash rejects a wrong password", () => {
  const encoded = encodePasswordHash("correct horse battery staple");
  assert.equal(verifyPasswordHash("wrong password", encoded), false);
});

test("encodePasswordHash produces a different encoded value each time (random salt per password)", () => {
  const a = encodePasswordHash("same password");
  const b = encodePasswordHash("same password");
  assert.notEqual(a, b);
  // Both still verify correctly despite being different ciphertexts.
  assert.equal(verifyPasswordHash("same password", a), true);
  assert.equal(verifyPasswordHash("same password", b), true);
});

test("verifyPasswordHash fails safely (false, not a throw) on a malformed encoded string", () => {
  assert.equal(verifyPasswordHash("anything", "not-a-valid-encoded-hash"), false);
  assert.equal(verifyPasswordHash("anything", ""), false);
  assert.equal(verifyPasswordHash("anything", "onlyonepart"), false);
});

test("createUser rejects an invalid email before touching the database", async () => {
  await assert.rejects(() => createUser("not-an-email", "a-fine-password", "Someone"), /valid email/);
});

test("createUser rejects a too-short password before touching the database", async () => {
  await assert.rejects(() => createUser("real@example.com", "short", "Someone"), /at least 8 characters/);
});
