/**
 * Unit tests for vaultGuard.ts's input-validation logic — the parts that
 * reject bad input *before* touching the database, so they're testable
 * without a real Postgres connection. Same DB-free-only-what's-possible
 * pattern as apiKeys.test.ts.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { assertEncryptionConfigured, validateNewVaultItem } from "./vaultGuard.js";

const ORIGINAL_KEY = process.env.KHAMELEON_ENCRYPTION_KEY;

beforeEach(() => {
  delete process.env.KHAMELEON_ENCRYPTION_KEY;
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.KHAMELEON_ENCRYPTION_KEY;
  else process.env.KHAMELEON_ENCRYPTION_KEY = ORIGINAL_KEY;
});

test("assertEncryptionConfigured throws when no key is set — fails closed", () => {
  assert.throws(() => assertEncryptionConfigured(), /KHAMELEON_ENCRYPTION_KEY/);
});

test("assertEncryptionConfigured passes when a real key is set", () => {
  process.env.KHAMELEON_ENCRYPTION_KEY = "a-decently-long-secret-key";
  assert.doesNotThrow(() => assertEncryptionConfigured());
});

test("validateNewVaultItem rejects a missing name before touching the database", () => {
  assert.throws(() => validateNewVaultItem({ category: "API Key", secretValue: "sk-test" }), /`name` is required/);
});

test("validateNewVaultItem rejects a whitespace-only name", () => {
  assert.throws(() => validateNewVaultItem({ name: "   ", category: "API Key", secretValue: "sk-test" }), /`name` is required/);
});

test("validateNewVaultItem rejects a missing category", () => {
  assert.throws(() => validateNewVaultItem({ name: "GitHub PAT", secretValue: "sk-test" }), /`category` is required/);
});

test("validateNewVaultItem rejects a missing secretValue", () => {
  assert.throws(() => validateNewVaultItem({ name: "GitHub PAT", category: "Token" }), /`secretValue` is required/);
});

test("validateNewVaultItem rejects an empty secretValue even with everything else present", () => {
  assert.throws(() => validateNewVaultItem({ name: "GitHub PAT", category: "Token", secretValue: "   " }), /`secretValue` is required/);
});

test("validateNewVaultItem checks field presence before encryption configuration — a bad name fails with the field error, not the encryption error", () => {
  // No KHAMELEON_ENCRYPTION_KEY set (see beforeEach) — if field checks ran
  // after the encryption check, this would throw the wrong message.
  assert.throws(() => validateNewVaultItem({ category: "Token", secretValue: "sk-test" }), /`name` is required/);
});

test("validateNewVaultItem fails closed on encryption once fields are otherwise valid", () => {
  assert.throws(
    () => validateNewVaultItem({ name: "GitHub PAT", category: "Token", secretValue: "sk-test" }),
    /KHAMELEON_ENCRYPTION_KEY/,
  );
});

test("validateNewVaultItem passes when everything is valid and encryption is configured", () => {
  process.env.KHAMELEON_ENCRYPTION_KEY = "a-decently-long-secret-key";
  assert.doesNotThrow(() => validateNewVaultItem({ name: "GitHub PAT", category: "Token", secretValue: "sk-test" }));
});
