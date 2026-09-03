/**
 * OAuth routes for all connectors.
 *
 * GET  /api/auth/oauth/google/start     → redirect to Google consent screen
 * GET  /api/auth/oauth/microsoft/start  → redirect to Microsoft consent screen
 * GET  /api/auth/oauth/callback         → exchange code, store token, redirect home
 * GET  /api/auth/oauth/:provider/status → check if connected
 * DELETE /api/auth/oauth/:provider      → revoke & delete stored token
 */

import { Router, type Request, type Response } from "express";
import { saveToken, deleteToken, isConnected } from "../lib/oauthTokens.js";
import crypto from "node:crypto";

const router = Router();

// ── CSRF state store (in-memory; single-user, short-lived) ───────────────────
interface PendingState { provider: string; createdAt: number; }
const pendingStates = new Map<string, PendingState>();
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pendingStates) if (v.createdAt < cutoff) pendingStates.delete(k);
}, 60_000);

function getRedirectUri(req: Request): string {
  if (process.env.OAUTH_REDIRECT_URI) return process.env.OAUTH_REDIRECT_URI;
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host  = req.headers["x-forwarded-host"] ?? req.headers.host;
  return `${proto}://${host}/api/auth/oauth/callback`;
}

function makeState(provider: string): string {
  const state = crypto.randomBytes(16).toString("hex");
  pendingStates.set(state, { provider, createdAt: Date.now() });
  return state;
}

// ── Google ────────────────────────────────────────────────────────────────────

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

router.get("/oauth/google/start", (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "GOOGLE_CLIENT_ID not configured" });
    return;
  }
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getRedirectUri(req));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", makeState("google"));
  res.redirect(url.toString());
});

async function exchangeGoogleCode(req: Request, code: string): Promise<void> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  getRedirectUri(req),
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json() as {
    access_token: string; refresh_token?: string; expires_in: number; scope: string;
  };
  await saveToken("google", {
    accessToken:   json.access_token,
    refreshToken:  json.refresh_token ?? null,
    expiresInSecs: json.expires_in,
    scope:         json.scope,
  });
}

// ── Microsoft ─────────────────────────────────────────────────────────────────

const MICROSOFT_TENANT = "common"; // works for personal Outlook + M365 accounts

const MICROSOFT_SCOPES = [
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/Calendars.ReadWrite",
  "https://graph.microsoft.com/User.Read",
  "offline_access",
].join(" ");

router.get("/oauth/microsoft/start", (req: Request, res: Response) => {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "MICROSOFT_CLIENT_ID not configured" });
    return;
  }
  const url = new URL(`https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getRedirectUri(req));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", MICROSOFT_SCOPES);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("state", makeState("microsoft"));
  res.redirect(url.toString());
});

async function exchangeMicrosoftCode(req: Request, code: string): Promise<void> {
  const res = await fetch(
    `https://login.microsoftonline.com/${MICROSOFT_TENANT}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        redirect_uri:  getRedirectUri(req),
        grant_type:    "authorization_code",
        scope:         MICROSOFT_SCOPES,
      }),
    }
  );
  if (!res.ok) throw new Error(`Microsoft exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json() as {
    access_token: string; refresh_token?: string; expires_in: number; scope: string;
  };
  await saveToken("microsoft", {
    accessToken:   json.access_token,
    refreshToken:  json.refresh_token ?? null,
    expiresInSecs: json.expires_in,
    scope:         json.scope,
  });
}

// ── Spotify ───────────────────────────────────────────────────────────────────

const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
].join(" ");

router.get("/oauth/spotify/start", (req: Request, res: Response) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({ error: "SPOTIFY_CLIENT_ID not configured" });
    return;
  }
  const url = new URL("https://accounts.spotify.com/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getRedirectUri(req));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SPOTIFY_SCOPES);
  url.searchParams.set("state", makeState("spotify"));
  res.redirect(url.toString());
});

async function exchangeSpotifyCode(req: Request, code: string): Promise<void> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.SPOTIFY_CLIENT_ID!,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET!,
      redirect_uri:  getRedirectUri(req),
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Spotify exchange failed: ${res.status} ${await res.text()}`);
  const json = await res.json() as {
    access_token: string; refresh_token?: string; expires_in: number; scope: string;
  };
  await saveToken("spotify", {
    accessToken:   json.access_token,
    refreshToken:  json.refresh_token ?? null,
    expiresInSecs: json.expires_in,
    scope:         json.scope,
  });
}

// ── Generic callback (all providers redirect here) ────────────────────────────

router.get("/oauth/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    req.log.warn({ error }, "OAuth callback error from provider");
    res.redirect(`/?oauth_error=${encodeURIComponent(error)}`);
    return;
  }

  const pending = pendingStates.get(state ?? "");
  if (!pending) {
    res.status(400).send("Invalid or expired OAuth state. Please try connecting again.");
    return;
  }
  pendingStates.delete(state);
  const { provider } = pending;

  try {
    if (provider === "google")    await exchangeGoogleCode(req, code);
    else if (provider === "microsoft") await exchangeMicrosoftCode(req, code);
    else if (provider === "spotify")   await exchangeSpotifyCode(req, code);
    else throw new Error(`Unknown provider: ${provider}`);

    req.log.info({ provider }, "OAuth token saved");
    res.redirect(`/?oauth_success=${provider}`);
  } catch (err) {
    req.log.error({ err, provider }, "OAuth exchange failed");
    res.redirect(`/?oauth_error=exchange_failed`);
  }
});

// ── Status & disconnect ───────────────────────────────────────────────────────

router.get("/oauth/:provider/status", async (req: Request, res: Response) => {
  try {
    res.json({ provider: req.params.provider, connected: await isConnected(req.params.provider) });
  } catch (err) {
    req.log.error({ err }, "Error checking OAuth status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/oauth/:provider", async (req: Request, res: Response) => {
  try {
    await deleteToken(req.params.provider);
    req.log.info({ provider: req.params.provider }, "OAuth token revoked");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error revoking OAuth token");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
