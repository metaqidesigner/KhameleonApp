/**
 * OAuth token store + automatic refresh middleware.
 * Add new provider refresh flows in REFRESHERS as connectors are added.
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

const EXPIRY_BUFFER_SECS = 300; // refresh 5 min before actual expiry

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getToken(provider: string): Promise<TokenRecord | null> {
  const [row] = await db
    .select()
    .from(oauthTokensTable)
    .where(eq(oauthTokensTable.provider, provider))
    .limit(1);
  return row
    ? { provider: row.provider, accessToken: row.accessToken,
        refreshToken: row.refreshToken ?? null, expiresAt: row.expiresAt ?? null, scope: row.scope }
    : null;
}

export function isExpired(token: TokenRecord): boolean {
  if (!token.expiresAt) return false;
  return token.expiresAt.getTime() - EXPIRY_BUFFER_SECS * 1000 < Date.now();
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function saveToken(
  provider: string,
  data: { accessToken: string; refreshToken?: string | null; expiresInSecs?: number | null; scope?: string }
): Promise<void> {
  const expiresAt = data.expiresInSecs ? new Date(Date.now() + data.expiresInSecs * 1000) : null;
  await db
    .insert(oauthTokensTable)
    .values({ provider, accessToken: data.accessToken, refreshToken: data.refreshToken ?? null, expiresAt, scope: data.scope ?? "" })
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

// ── Provider refresh logic ─────────────────────────────────────────────────────

async function refreshGoogle(token: TokenRecord): Promise<TokenRecord> {
  if (!token.refreshToken) throw new Error("No refresh token for Google");
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID/SECRET not set");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: token.refreshToken, grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google refresh failed: ${res.status} ${await res.text()}`);
  const json = await res.json() as { access_token: string; expires_in: number; scope?: string };
  await saveToken("google", {
    accessToken: json.access_token, refreshToken: token.refreshToken,
    expiresInSecs: json.expires_in, scope: json.scope ?? token.scope,
  });
  return (await getToken("google"))!;
}

async function refreshMicrosoft(token: TokenRecord): Promise<TokenRecord> {
  if (!token.refreshToken) throw new Error("No refresh token for Microsoft");
  const clientId     = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("MICROSOFT_CLIENT_ID/SECRET not set");

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      refresh_token: token.refreshToken, grant_type: "refresh_token",
      scope: "https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Calendars.ReadWrite offline_access",
    }),
  });
  if (!res.ok) throw new Error(`Microsoft refresh failed: ${res.status} ${await res.text()}`);
  const json = await res.json() as {
    access_token: string; refresh_token?: string; expires_in: number; scope?: string;
  };
  await saveToken("microsoft", {
    accessToken: json.access_token,
    // Microsoft may rotate the refresh token; always persist the latest one
    refreshToken: json.refresh_token ?? token.refreshToken,
    expiresInSecs: json.expires_in,
    scope: json.scope ?? token.scope,
  });
  return (await getToken("microsoft"))!;
}

const REFRESHERS: Record<string, (t: TokenRecord) => Promise<TokenRecord>> = {
  google:    refreshGoogle,
  microsoft: refreshMicrosoft,
};

// ── Public API ────────────────────────────────────────────────────────────────

export async function getFreshToken(provider: string): Promise<string> {
  let token = await getToken(provider);
  if (!token) throw new Error(`No token stored for provider: ${provider}`);
  if (isExpired(token)) {
    logger.info({ provider }, "OAuth token near-expired, refreshing");
    const refresher = REFRESHERS[provider];
    if (!refresher) throw new Error(`No refresh logic for provider: ${provider}`);
    token = await refresher(token);
    logger.info({ provider }, "OAuth token refreshed");
  }
  return token.accessToken;
}

export async function isConnected(provider: string): Promise<boolean> {
  const token = await getToken(provider);
  if (!token) return false;
  if (isExpired(token) && !token.refreshToken) return false;
  return true;
}
