/**
 * Unit tests for crypto.ts. Zero external dependencies (just node:crypto),
 * so — unlike most of this session's other new tests — this one runs
 * directly in any Node environment without a DB or an isolated scratch
 * install.
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const ORIGINAL_KEY = process.env.KHAMELEON_ENCRYPTION_KEY;

function freshModule() {
  // Each test needs its own module instance because encrypt()/decrypt()
  // cache the derived master key at module scope — re-import with a cache
  // buster so changing KHAMELEON_ENCRYPTION_KEY between tests actually
  // takes effect instead of reusing a stale cached key.
  return import(`./crypto.js?t=${Date.now()}-${Math.random()}`);
}

beforeEach(() => {
  delete process.env.KHAMELEON_ENCRYPTION_KEY;
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.KHAMELEON_ENCRYPTION_KEY;
  else process.env.KHAMELEON_ENCRYPTION_KEY = ORIGINAL_KEY;
});

test("isEncryptionConfigured is false with no key set", async () => {
  const { isEncryptionConfigured } = await freshModule();
  assert.equal(isEncryptionConfigured(), false);
});

test("isEncryptionConfigured is false for a too-short key", async () => {
  process.env.KHAMELEON_ENCRYPTION_KEY = "short";
  const { isEncryptionConfigured } = await freshModule();
  assert.equal(isEncryptionConfigured(), false);
});

test("isEncryptionConfigured is true for a 16+ character key", async () => {
  process.env.KHAMELEON_ENCRYPTION_KEY = "a-decently-long-secret-key";
  const { isEncryptionConfigured } = await freshModule();
  assert.equal(isEncryptionConfigured(), true);
});

test("encrypt() throws when no key is configured — fails closed, not plaintext", async () => {
  const { encrypt } = await freshModule();
  assert.throws(() => encrypt("sk-super-secret"), /KHAMELEON_ENCRYPTION_KEY/);
});

test("encrypt() then decrypt() round-trips the original plaintext", async () => {
  process.env.KHAMELEON_ENCRYPTION_KEY = "test-master-key-for-unit-tests";
  const { encrypt, decrypt } = await freshModule();
  const secret = "sk-ant-abc123-very-secret-value";
  const encrypted = encrypt(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(decrypt(encrypted), secret);
});

test("encrypted values don't contain the plaintext anywhere", async () => {
  process.env.KHAMELEON_ENCRYPTION_KEY = "another-test-master-key-value";
  const { encrypt } = await freshModule();
  const secret = "sk-ant-super-recognizable-token-xyz";
  const encrypted = encrypt(secret);
  assert.equal(encrypted.includes(secret), false);
});

test("two encryptions of the same plaintext produce different ciphertext (random IV)", async () => {
  process.env.KHAMELEON_ENCRYPTION_KEY = "yet-another-test-master-key";
  const { encrypt } = await freshModule();
  const secret = "sk-same-value-both-times";
  assert.notEqual(encrypt(secret), encrypt(secret));
});

test("decrypt() passes through a legacy plaintext value unchanged", async () => {
  process.env.KHAMELEON_ENCRYPTION_KEY = "legacy-passthrough-test-key";
  const { decrypt } = await freshModule();
  const legacyPlaintext = "AQAB-some-old-unencrypted-token";
  assert.equal(decrypt(legacyPlaintext), legacyPlaintext);
});

test("decrypt() fails loudly on tampered ciphertext rather than returning garbage", async () => {
  process.env.KHAMELEON_ENCRYPTION_KEY = "tamper-detection-test-key";
  const { encrypt, decrypt } = await freshModule();
  const encrypted = encrypt("sk-original-value");
  const parts = encrypted.split(":");
  // Flip the last character of the ciphertext segment to corrupt it
  const corruptedData = parts[3].slice(0, -1) + (parts[3].slice(-1) === "A" ? "B" : "A");
  const tampered = [parts[0], parts[1], parts[2], corruptedData].join(":");
  assert.throws(() => decrypt(tampered));
});
