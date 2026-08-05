/**
 * OAuth token store + automatic refresh middleware.
 *
 * Supports any provider; Google-specific refresh logic is wired here.
 * Add new provider refresh flows in `refreshAccessToken` as connectors are added.
 */

import { db } from "@workspace/db";
import { oauthTokensTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";

export interface TokenRecord {
  provider: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string;
}

/** How many seconds before actual expiry we consider the token stale */
const EXPIRY_BUFFER_SECS = 300; // 5 minutes

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getToken(provider: string): Promise<TokenRecord | null> {
  const [row] = await db
    .select()
    .from(oauthTokensTable)
    .where(eq(oauthTokensTable.provider, provider))
    .limit(1);

  return row
    ? {
        provider: row.provider,
        accessToken: row.accessToken,
        refreshToken: row.refreshToken ?? null,
        expiresAt: row.expiresAt ?? null,
        scope: row.scope,
      }
    : null;
}

export function isExpired(token: TokenRecord): boolean {
  if (!token.expiresAt) return false; // no expiry = never expires
  const bufferMs = EXPIRY_BUFFER_SECS * 1000;
  return token.expiresAt.getTime() - bufferMs < Date.now();
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function saveToken(
  provider: string,
  data: {
    accessToken: string;
    refreshToken?: string | null;
    expiresInSecs?: number | null;
    scope?: string;
  }
): Promise<void> {
  const expiresAt = data.expiresInSecs
    ? new Date(Date.now() + data.expiresInSecs * 1000)
    : null;

  await db
    .insert(oauthTokensTable)
    .values({
      provider,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? null,
      expiresAt,
      scope: data.scope ?? "",
    })
    .onConflictDoUpdate({
      target: oauthTokensTable.provider,
      set: {
        accessToken: data.accessToken,
        ...(data.refreshToken !== undefined && { refreshToken: data.refreshToken }),
        expiresAt,
        ...(data.scope !== undefined && { scope: data.scope }),
        updatedAt: new Date(),
      },
    });
}

export async function deleteToken(provider: string): Promise<void> {
  await db.delete(oauthTokensTable).where(eq(oauthTokensTable.provider, provider));
}

// ── Refresh ───────────────────────────────────────────────────────────────────

async function refreshGoogle(token: TokenRecord): Promise<TokenRecord> {
  if (!token.refreshToken) throw new Error("No refresh token available for Google");

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID/SECRET not set");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token refresh failed: ${res.status} ${body}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope?: string;
  };

  await saveToken("google", {
    accessToken: json.access_token,
    refreshToken: token.refreshToken, // Google keeps the same refresh token
    expiresInSecs: json.expires_in,
    scope: json.scope ?? token.scope,
  });

  return (await getToken("google"))!;
}

const REFRESHERS: Record<string, (t: TokenRecord) => Promise<TokenRecord>> = {
  google: refreshGoogle,
};

/**
 * Returns a fresh access token for the given provider.
 * Automatically refreshes if the token is within the expiry buffer.
 * Throws if no token is stored or refresh fails.
 */
export async function getFreshToken(provider: string): Promise<string> {
  let token = await getToken(provider);
  if (!token) throw new Error(`No token stored for provider: ${provider}`);

  if (isExpired(token)) {
    logger.info({ provider }, "OAuth token near-expired, refreshing");
    const refresher = REFRESHERS[provider];
    if (!refresher) throw new Error(`No refresh logic for provider: ${provider}`);
    token = await refresher(token);
    logger.info({ provider }, "OAuth token refreshed successfully");
  }

  return token.accessToken;
}

/**
 * Returns true if a valid (non-expired or refreshable) token exists.
 * Does NOT actually call the refresh — just checks presence and expiry state.
 */
export async function isConnected(provider: string): Promise<boolean> {
  const token = await getToken(provider);
  if (!token) return false;
  // If it's expired and there's no refresh token, it's effectively disconnected
  if (isExpired(token) && !token.refreshToken) return false;
  return true;
}
