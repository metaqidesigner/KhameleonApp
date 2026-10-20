/**
 * OAuth routes for all connectors, plus the session routes for both
 * account-isolation options (Option A, shared password - 2026-10-01; Option
 * B, real per-user accounts - 2026-10-03. See lib/session.ts's docblock for
 * how the two compose: Option B wins the moment any account exists).
 *
 * GET  /api/auth/oauth/google/start     → redirect to Google consent screen
 * GET  /api/auth/oauth/microsoft/start  → redirect to Microsoft consent screen
 * GET  /api/auth/oauth/callback         → exchange code, store token, redirect home
 * GET  /api/auth/oauth/:provider/status → check if connected
 * DELETE /api/auth/oauth/:provider      → revoke & delete stored token
 *
 * GET  /api/auth/session         → { authRequired, authenticated, mode, user? } - always reachable, even logged out
 * POST /api/auth/session         → { password } (Option A) or { email, password } (Option B) - log in
 * POST /api/auth/session/logout  → clears the session cookie
 * POST /api/auth/signup          → { email, password, displayName } - creates the first (admin) account when
 *                                   none exist yet; once accounts mode is active, requires an admin session
 *                                   (no public registration surface - see accounts.ts's docblock)
 */

import { Router, type Request, type Response } from "express";
import { COPILOT_SCOPES, COPILOT_TENANT } from "../lib/copilotChat.js";
import { saveToken, deleteToken, isConnected } from "../lib/oauthTokens.js";
import {
  isAppAuthConfigured, verifyPassword, createSession, isValidSession, destroySession, currentUserId, SESSION_COOKIE,
} from "../lib/session.js";
import { accountsEnabled, createUser, verifyLogin, getUserById } from "../lib/accounts.js";
import { db } from "@workspace/db";
import { actionReceiptsTable } from "@workspace/db";
import { safeReturnTo } from "../lib/returnTo.js";
import { getMicrosoftApp, secretParams, OUTLOOK_SCOPES, adminApprovalUrl, needsAdminApproval, type MicrosoftApp } from "../lib/microsoftApp.js";
import { signedInPage, needsItPage, signInProblemPage } from "../lib/signInPages.js";
import crypto from "node:crypto";

const router = Router();

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function setSessionCookie(req: Request, res: Response, userId?: number): void {
  res.cookie(SESSION_COOKIE, createSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

router.get("/session", async (req: Request, res: Response) => {
  if (await accountsEnabled()) {
    const userId = currentUserId(req);
    const user = userId !== undefined ? await getUserById(userId) : undefined;
    res.json({ authRequired: true, authenticated: !!user, mode: "accounts", user: user ? { id: user.id, email: user.email, displayName: user.displayName, isAdmin: user.isAdmin } : null });
    return;
  }
  const authRequired = isAppAuthConfigured();
  const authenticated = !authRequired || isValidSession(req.cookies?.[SESSION_COOKIE]);
  res.json({ authRequired, authenticated, mode: "password" });
});

router.post("/signup", async (req: Request, res: Response) => {
  const { email, password, displayName } = req.body as { email?: unknown; password?: unknown; displayName?: unknown };
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  const alreadyHasAccounts = await accountsEnabled();
  if (alreadyHasAccounts) {
    // Not the bootstrap case - only an existing admin may create further accounts (no open public signup).
    const requesterId = currentUserId(req);
    const requester = requesterId !== undefined ? await getUserById(requesterId) : undefined;
    if (!requester?.isAdmin) {
      res.status(403).json({ error: "Only an admin can create new accounts." });
      return;
    }
  }

  try {
    const user = await createUser(email, password, typeof displayName === "string" ? displayName : "");
    if (!alreadyHasAccounts) {
      // Bootstrap: the first account logs itself in immediately.
      setSessionCookie(req, res, user.id);
    }
    res.status(201).json({ ok: true, user });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Signup failed." });
  }
});

router.post("/session", async (req: Request, res: Response) => {
  if (await accountsEnabled()) {
    const { email, password } = req.body as { email?: unknown; password?: unknown };
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }
    const user = await verifyLogin(email, password);
    if (!user) {
      res.status(401).json({ error: "Incorrect email or password." });
      return;
    }
    setSessionCookie(req, res, user.id);
    res.json({ ok: true, user });
    return;
  }

  if (!isAppAuthConfigured()) {
    // Nothing to log into - matches the open-by-default behavior everywhere else.
    res.json({ ok: true });
    return;
  }
  const { password } = req.body as { password?: unknown };
  if (typeof password !== "string" || !verifyPassword(password)) {
    res.status(401).json({ error: "Incorrect password." });
    return;
  }
  setSessionCookie(req, res);
  res.json({ ok: true });
});

router.post("/session/logout", (req: Request, res: Response) => {
  destroySession(req.cookies?.[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

// ── CSRF state store (in-memory; single-user, short-lived) ───────────────────
interface PendingState {
  provider: string; createdAt: number; returnTo: string;
  /** Khameleon's built-in Microsoft sign-in (public client): the PKCE check and the redirect it used. */
  codeVerifier?: string; redirectUri?: string;
}
const pendingStates = new Map<string, PendingState>();
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of pendingStates) if (v.createdAt < cutoff) pendingStates.delete(k);
}, 60_000);

export function getRedirectUri(req: Request): string {
  if (process.env.OAUTH_REDIRECT_URI) return process.env.OAUTH_REDIRECT_URI;
  const proto = req.headers["x-forwarded-proto"] ?? req.protocol;
  const host  = req.headers["x-forwarded-host"] ?? req.headers.host;
  return `${proto}://${host}/api/auth/oauth/callback`;
}

function makeState(provider: string, req: Request, extra: Pick<PendingState, "codeVerifier" | "redirectUri"> = {}): string {
  const state = crypto.randomBytes(16).toString("hex");
  const asked = typeof req.query.returnTo === "string" ? req.query.returnTo : req.get("referer");
  const host = (req.headers["x-forwarded-host"] as string | undefined) ?? req.headers.host;
  pendingStates.set(state, { provider, createdAt: Date.now(), returnTo: safeReturnTo(asked, host), ...extra });
  return state;
}

// ── Khameleon's built-in Microsoft sign-in (public client) ───────────────────
// Registered with Microsoft as a desktop app: redirect http://localhost (any
// port - Microsoft ignores it for localhost), so the browser comes back to
// this computer's own Khameleon (app.ts forwards "/?code=..." to the callback).

const pkceVerifier = () => crypto.randomBytes(32).toString("base64url");
const pkceChallenge = (verifier: string) => crypto.createHash("sha256").update(verifier).digest("base64url");

function isThisComputer(req: Request): boolean {
  return /^localhost(:\d+)?$/i.test(String(req.headers.host ?? ""));
}

const BUILT_IN_ONLY_HERE = "Khameleon's built-in Microsoft sign-in works in the Khameleon desktop app. On a shared server, an admin adds your organisation's own Microsoft registration in Settings > Microsoft sign-in.";

/** Starts a Microsoft sign-in - with PKCE and a localhost redirect for Khameleon's built-in registration. */
function microsoftAuthorizeUrl(req: Request, msApp: MicrosoftApp, provider: "microsoft" | "copilot", tenant: string, scopes: string): string {
  const redirectUri = msApp.public ? `http://${req.headers.host}` : getRedirectUri(req);
  const codeVerifier = msApp.public ? pkceVerifier() : undefined;
  const url = new URL(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", msApp.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("prompt", "select_account"); // usually one click: pick the account already signed in
  if (codeVerifier) {
    url.searchParams.set("code_challenge", pkceChallenge(codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");
  }
  url.searchParams.set("state", makeState(provider, req, { codeVerifier, redirectUri }));
  return url.toString();
}

/** Swaps the sign-in code for tokens (no secret for the built-in registration; PKCE proves it's the same sign-in). */
async function microsoftTokens(req: Request, msApp: MicrosoftApp, tenant: string, scopes: string, code: string, pending: PendingState) {
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: msApp.clientId,
      ...secretParams(msApp),
      ...(pending.codeVerifier ? { code_verifier: pending.codeVerifier } : {}),
      redirect_uri: pending.redirectUri ?? getRedirectUri(req),
      grant_type: "authorization_code",
      scope: scopes,
    }),
  });
  if (!res.ok) throw new Error(`Microsoft sign-in failed: ${res.status} ${await res.text()}`);
  return await res.json() as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
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
  url.searchParams.set("state", makeState("google", req));
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
// One sign-in, asked once: read, sort and draft email, and the calendar - never "send" (download decisions, 2026-10-20).
const MICROSOFT_SCOPES = OUTLOOK_SCOPES.join(" ");

router.get("/oauth/microsoft/start", async (req: Request, res: Response) => {
  const msApp = await getMicrosoftApp();
  if (!msApp) {
    res.status(503).json({ error: "Microsoft sign-in isn't set up yet - an admin adds the app details in Settings > Microsoft sign-in." });
    return;
  }
  if (msApp.public && !isThisComputer(req)) { res.status(503).json({ error: BUILT_IN_ONLY_HERE }); return; }
  res.redirect(microsoftAuthorizeUrl(req, msApp, "microsoft", MICROSOFT_TENANT, MICROSOFT_SCOPES));
});

async function exchangeMicrosoftCode(req: Request, code: string, pending: PendingState): Promise<void> {
  const msApp = await getMicrosoftApp();
  if (!msApp) throw new Error("Microsoft sign-in isn't set up");
  const json = await microsoftTokens(req, msApp, MICROSOFT_TENANT, MICROSOFT_SCOPES, code, pending);
  await saveToken("microsoft", {
    accessToken:   json.access_token,
    refreshToken:  json.refresh_token ?? null,
    expiresInSecs: json.expires_in,
    scope:         json.scope,
  });
}

// ── Microsoft 365 Copilot (lib/copilotChat.ts) ───────────────────────────────
// A separate sign-in from Outlook: work accounts only, a Copilot licence, and
// the read permissions Microsoft's Copilot Chat API requires (admin approval).

router.get("/oauth/copilot/start", async (req: Request, res: Response) => {
  const msApp = await getMicrosoftApp();
  if (!msApp) {
    res.status(503).json({ error: "Microsoft sign-in isn't set up yet - an admin adds the app details in Settings > Microsoft sign-in." });
    return;
  }
  if (msApp.public && !isThisComputer(req)) { res.status(503).json({ error: BUILT_IN_ONLY_HERE }); return; }
  res.redirect(microsoftAuthorizeUrl(req, msApp, "copilot", COPILOT_TENANT, COPILOT_SCOPES));
});

async function exchangeCopilotCode(req: Request, code: string, pending: PendingState): Promise<void> {
  const msApp = await getMicrosoftApp();
  if (!msApp) throw new Error("Microsoft sign-in isn't set up");
  const json = await microsoftTokens(req, msApp, COPILOT_TENANT, COPILOT_SCOPES, code, pending);
  await saveToken("copilot", {
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
  url.searchParams.set("state", makeState("spotify", req));
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
  const { code, state, error, error_description: errorDescription } = req.query as Record<string, string>;

  if (error) {
    req.log.warn({ error }, "OAuth callback error from provider");
    const pendingErr = pendingStates.get(state ?? "");
    // Khameleon's built-in Microsoft sign-in happens in the person's web browser: show a page there.
    if (pendingErr?.codeVerifier) {
      pendingStates.delete(state);
      const msApp = await getMicrosoftApp();
      if (msApp && needsAdminApproval(error, errorDescription)) {
        res.type("html").send(needsItPage(adminApprovalUrl(msApp.clientId, pendingErr.provider === "copilot" ? COPILOT_SCOPES.split(" ") : OUTLOOK_SCOPES), pendingErr.provider === "copilot"));
        return;
      }
      res.type("html").send(signInProblemPage(error === "access_denied" ? "The sign-in was cancelled." : `Microsoft said: ${errorDescription ?? error}`));
      return;
    }
    const back = pendingErr?.returnTo ?? "";
    res.redirect(`${back}/?oauth_error=${encodeURIComponent(error)}`);
    return;
  }

  const pending = pendingStates.get(state ?? "");
  if (!pending) {
    res.status(400).send("Invalid or expired OAuth state. Please try connecting again.");
    return;
  }
  pendingStates.delete(state);
  const { provider, returnTo } = pending;

  try {
    if (provider === "google")    await exchangeGoogleCode(req, code);
    else if (provider === "microsoft") await exchangeMicrosoftCode(req, code, pending);
    else if (provider === "copilot")   await exchangeCopilotCode(req, code, pending);
    else if (provider === "spotify")   await exchangeSpotifyCode(req, code);
    else throw new Error(`Unknown provider: ${provider}`);

    req.log.info({ provider }, "OAuth token saved");

    // design-spec.md §16.5: a connection change is logged as an action
    // receipt, the same as any other local/reversible action.
    try {
      await db.insert(actionReceiptsTable).values({
        description: `Connected ${provider}`,
        category: "integration_connect",
        scope: `oauth:${provider}`,
        outcome: "success",
        target: provider,
        canUndo: true, // "undo" here means disconnect, not undoing anything already read/written
      });
    } catch (receiptErr) {
      req.log.warn({ receiptErr, provider }, "Failed to write connect receipt (non-fatal)");
    }

    if (pending.codeVerifier) { res.type("html").send(signedInPage(provider === "copilot" ? "Copilot" : "Microsoft")); return; }
    res.redirect(`${returnTo}/?oauth_success=${provider}`);
  } catch (err) {
    req.log.error({ err, provider }, "OAuth exchange failed");
    if (pending.codeVerifier) { res.type("html").send(signInProblemPage("Khameleon couldn't finish the sign-in. Please try again from Khameleon.")); return; }
    res.redirect(`${returnTo}/?oauth_error=exchange_failed`);
  }
});

// ── Status & disconnect ───────────────────────────────────────────────────────

router.get("/oauth/:provider/status", async (req: Request, res: Response) => {
  try {
    const provider = String(req.params.provider);
    res.json({ provider, connected: await isConnected(provider) });
  } catch (err) {
    req.log.error({ err }, "Error checking OAuth status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/oauth/:provider", async (req: Request, res: Response) => {
  try {
    await deleteToken(String(req.params.provider));
    req.log.info({ provider: req.params.provider }, "OAuth token revoked");

    // §16.5: disconnecting is local and reversible - logged as a receipt,
    // with a note that already-completed external actions aren't undone.
    try {
      await db.insert(actionReceiptsTable).values({
        description: `Disconnected ${req.params.provider} (any actions already taken while connected are not undone)`,
        category: "integration_disconnect",
        scope: `oauth:${req.params.provider}`,
        outcome: "success",
        target: String(req.params.provider),
        canUndo: false,
      });
    } catch (receiptErr) {
      req.log.warn({ receiptErr }, "Failed to write disconnect receipt (non-fatal)");
    }

    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Error revoking OAuth token");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
