/**
 * Encryption at rest for stored credentials — API keys (apiKeys.ts) and
 * OAuth access/refresh tokens (oauthTokens.ts). Added 2026-08-27 in direct
 * response to both being flagged as plaintext when the onboarding/API-key
 * work landed earlier the same day.
 *
 * AES-256-GCM via Node's built-in `crypto` — no new dependency, consistent
 * with the rest of this codebase's minimal-dependency pattern. The master
 * key is derived once (scrypt) from an operator-provided secret
 * (`KHAMELEON_ENCRYPTION_KEY`, set as a Replit Secret) and cached in memory;
 * each individual value gets its own random IV and auth tag.
 *
 * Deliberately fails closed: if `KHAMELEON_ENCRYPTION_KEY` isn't set,
 * `encrypt()` throws rather than silently falling back to plaintext. This
 * mirrors the existing `SCHEDULER_ADMIN_KEY` pattern in scheduler.ts — a
 * missing secret disables the feature with a clear error instead of quietly
 * doing the less-safe thing.
 *
 * This is real application-level encryption, not a substitute for a proper
 * secrets manager (HashiCorp Vault / AWS Secrets Manager, as already noted
 * as future work in vault.ts) — the key still lives in an env var on this
 * server. Good enough to stop credentials sitting in the database as plain
 * text; not the end state for a multi-tenant commercial product.
 */

import crypto from "node:crypto";

const ALGORITHM  = "aes-256-gcm";
const IV_LENGTH  = 12; // 96-bit IV, recommended size for GCM
const KEY_LENGTH = 32; // AES-256
const KDF_SALT   = "khameleon-credentials-v1"; // fixed, non-secret — the env var supplies the actual entropy
const FORMAT_TAG = "v1";

let cachedKey: Buffer | null = null;

function getMasterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.KHAMELEON_ENCRYPTION_KEY ?? "";
  if (secret.trim().length < 16) {
    throw new Error(
      "KHAMELEON_ENCRYPTION_KEY is not set (or is shorter than 16 characters). " +
        "Set it as a Replit Secret before saving credentials — without it, API keys and " +
        "OAuth tokens cannot be encrypted at rest, so saving is refused rather than silently " +
        "storing them as plaintext.",
    );
  }
  cachedKey = crypto.scryptSync(secret, KDF_SALT, KEY_LENGTH);
  return cachedKey;
}

/** True if a usable encryption key is configured. Safe to call to gate UI/route behavior. */
export function isEncryptionConfigured(): boolean {
  return (process.env.KHAMELEON_ENCRYPTION_KEY ?? "").trim().length >= 16;
}

/** Encrypts a plaintext string. Throws if KHAMELEON_ENCRYPTION_KEY isn't configured. */
export function encrypt(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [FORMAT_TAG, iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":");
}

/**
 * Decrypts a value produced by encrypt(). If the value doesn't match the
 * encrypted format (no "v1:" tag), it's treated as a legacy plaintext value
 * saved before encryption was added and returned unchanged — so upgrading
 * doesn't break already-connected accounts. The next time that value is
 * saved (e.g. on OAuth token refresh), it gets encrypted going forward.
 */
export function decrypt(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== FORMAT_TAG) {
    return payload;
  }
  const [, ivB64, tagB64, dataB64] = parts;
  const key = getMasterKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
