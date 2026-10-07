/**
 * User-supplied API keys for model providers (Anthropic, OpenAI, Gemini,
 * OpenRouter, Minimax) — distinct from oauthTokens.ts, which handles OAuth
 * connectors (Google/Microsoft/Spotify) where the user clicks "Connect"
 * instead of typing a secret in.
 *
 * Added 2026-08-27 so every credential Khameleon needs — OAuth connections
 * *and* raw API keys — can be entered by the user during setup instead of
 * only being configurable via server environment variables.
 *
 * Storage note: reuses `settingsTable` (the same plain key/value store
 * scheduler config and the weather default location already use), namespaced
 * under `apikey.*`. Values are encrypted at rest via crypto.ts (AES-256-GCM,
 * added 2026-08-27) — the row itself just looks like a longer opaque string,
 * same column as everything else in settingsTable.
 *
 * Hosted/managed mode, Phase 3 (khameleon-decisions-log.md, 2026-10-03): the
 * key is now namespaced per-account too (apikey.<userId>.<provider>) once
 * accounts mode is active - resolved automatically from the current
 * request via requestContext.ts, same pattern as oauthTokens.ts/vault.ts, so
 * every existing call site (gateway.ts, anthropicClient.ts, vaultGuard.ts,
 * routes/onboarding.ts) needed zero changes. With no request active (a
 * scheduled job, e.g. scheduler.ts's morning digest) this intentionally
 * keeps reading the legacy global apikey.<provider> slot - the same
 * behavior as today, not silently reassigned to whichever account happens
 * to be admin. A scheduled job picking up one specific account's personal
 * key is a real, separate product question (whose morning digest is it in
 * a team?), not assumed here.
 */

import { db, settingsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { encrypt, decrypt } from "./crypto.js";
import { getCurrentUserId } from "./requestContext.js";

const KEY_PREFIX = "apikey.";

/** Model-provider ids that take a raw API key (as opposed to an OAuth connector). */
export const API_KEY_PROVIDERS = ["anthropic", "openai", "google", "openrouter", "minimax"] as const;
export type ApiKeyProvider = (typeof API_KEY_PROVIDERS)[number];

function isKnownProvider(provider: string): provider is ApiKeyProvider {
  return (API_KEY_PROVIDERS as readonly string[]).includes(provider);
}

function settingsKey(provider: string): string {
  const userId = getCurrentUserId();
  return userId === undefined ? `${KEY_PREFIX}${provider}` : `${KEY_PREFIX}${userId}.${provider}`;
}

/** Returns the stored key for a provider (decrypted), or null if none is saved. */
export async function getApiKey(provider: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, settingsKey(provider)))
    .limit(1);
  if (!row?.value?.trim()) return null;
  return decrypt(row.value);
}

/**
 * Saves (or overwrites) a provider's API key, encrypted at rest.
 * Throws for an unknown provider, an empty key, or — deliberately — if
 * `KHAMELEON_ENCRYPTION_KEY` isn't configured (see crypto.ts: fails closed
 * rather than silently storing plaintext).
 */
export async function setApiKey(provider: string, value: string): Promise<void> {
  if (!isKnownProvider(provider)) {
    throw new Error(`Unknown API key provider: '${provider}'. Expected one of: ${API_KEY_PROVIDERS.join(", ")}.`);
  }
  const trimmed = value.trim();
  if (!trimmed) throw new Error("API key cannot be empty.");

  const encrypted = encrypt(trimmed);
  await db
    .insert(settingsTable)
    .values({ key: settingsKey(provider), value: encrypted })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: encrypted, updatedAt: new Date() } });
}

/** Clears a provider's saved API key (falls back to any server-level env var afterward). */
export async function clearApiKey(provider: string): Promise<void> {
  if (!isKnownProvider(provider)) {
    throw new Error(`Unknown API key provider: '${provider}'. Expected one of: ${API_KEY_PROVIDERS.join(", ")}.`);
  }
  await db.delete(settingsTable).where(eq(settingsTable.key, settingsKey(provider)));
}

/**
 * Returns which providers have a key saved — booleans only, never the key
 * value itself, so this is safe to expose directly to the frontend.
 */
export async function listApiKeyStatus(): Promise<Record<ApiKeyProvider, boolean>> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, API_KEY_PROVIDERS.map(settingsKey)));
  const set = new Set(rows.filter((r) => r.value?.trim()).map((r) => r.key));

  const result = {} as Record<ApiKeyProvider, boolean>;
  for (const provider of API_KEY_PROVIDERS) {
    result[provider] = set.has(settingsKey(provider));
  }
  return result;
}
