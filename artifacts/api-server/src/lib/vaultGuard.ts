/**
 * Pure input-validation and fail-closed logic for routes/vault.ts, split out
 * so it's testable without a live Postgres connection — same pattern as
 * apiKeys.ts's setApiKey validation and commandClassifier.ts's prompt-building.
 *
 * Throws with a specific message on failure; the route catches and maps to
 * a 400. Never touches the database.
 */

import { isEncryptionConfigured } from "./crypto.js";

/** Fails closed: refuses to proceed if KHAMELEON_ENCRYPTION_KEY isn't set, rather than storing plaintext. */
export function assertEncryptionConfigured(): void {
  if (!isEncryptionConfigured()) {
    throw new Error(
      "KHAMELEON_ENCRYPTION_KEY is not configured — secrets cannot be encrypted, so saving is refused rather than storing them as plaintext.",
    );
  }
}

/** Validates a new vault item's required fields and that a secret can actually be encrypted before anything touches the database. */
export function validateNewVaultItem(body: { name?: string; category?: string; secretValue?: string }): void {
  if (typeof body.name !== "string" || !body.name.trim()) {
    throw new Error("`name` is required.");
  }
  if (typeof body.category !== "string" || !body.category.trim()) {
    throw new Error("`category` is required.");
  }
  if (typeof body.secretValue !== "string" || !body.secretValue.trim()) {
    throw new Error("`secretValue` is required.");
  }
  assertEncryptionConfigured();
}
