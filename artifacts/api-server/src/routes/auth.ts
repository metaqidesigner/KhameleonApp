/**
 * OAuth routes for all connectors.
 *
 * Flow:
 *   GET /api/auth/oauth/google/start  → redirect to Google consent screen
 *   GET /api/auth/oauth/callback      → exchange code, store token, redirect to /settings
 *   DELETE /api/auth/oauth/:provider  → revoke & delete stored token
 *   GET /api/auth/oauth/:provider/status → check if connected
 */

import { Router, type Request, type Response } from "express";
import { saveToken, deleteToken, isConnected } from "../lib/oauthTokens.js";
import crypto from "node:crypto";

const router = Router();

// ── CSRF state store (in-memory; single-user, short-lived) ───────────────────
interface PendingState {
  provider: string;
  createdAt: number;
}
const pendingStates = new Map<string, PendingState>();

// Clean up states older than 10 minutes every minute
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pendingStates) {
    if (v.createdAt < cutoff) pendingStates.delete(k);
  }
}, 60_000);

function getRedirectUri(req: Request): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  // Auto-detect from request host (works behind the Replit proxy)
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host  = req.headers["x-forwarded-host"] ?? req.headers.host;
  return `${proto}://${host}/api/auth/oauth/callback`;
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
    res.status(503).json({
      error: "GOOGLE_CLIENT_ID not configured",
      hint: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as Replit secrets",
    });
    return;
  }

  const state = crypto.randomBytes(16).toString("hex");
  pendingStates.set(state, { provider: "google", createdAt: Date.now() });

  const redirectUri = getRedirectUri(req);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES);
  url.searchParams.set("access_type", "offline");   // request refresh token
  url.searchParams.set("prompt", "consent");         // always show consent so we get refresh_token
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

// ── Generic callback (all providers land here) ────────────────────────────────

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
    if (provider === "google") {
      await exchangeGoogleCode(req, code);
    } else {
      throw new Error(`Unknown provider: ${provider}`);
    }

    req.log.info({ provider }, "OAuth token saved successfully");
    // Redirect to settings with success signal
    res.redirect(`/?oauth_success=${provider}`);
  } catch (err) {
    req.log.error({ err, provider }, "OAuth token exchange failed");
    res.redirect(`/?oauth_error=exchange_failed`);
  }
});

async function exchangeGoogleCode(req: Request, code: string): Promise<void> {
  const clientId     = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const redirectUri  = getRedirectUri(req);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${body}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  await saveToken("google", {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresInSecs: json.expires_in,
    scope: json.scope,
  });
}

// ── Status check ──────────────────────────────────────────────────────────────

router.get("/oauth/:provider/status", async (req: Request, res: Response) => {
  try {
    const connected = await isConnected(req.params.provider);
    res.json({ provider: req.params.provider, connected });
  } catch (err) {
    req.log.error({ err }, "Error checking OAuth status");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Disconnect ────────────────────────────────────────────────────────────────

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
