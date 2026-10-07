/**
 * Account isolation, Option A (see khameleon-decisions-log.md, 2026-10-01):
 * one shared password in front of the whole app, opt-in via
 * KHAMELEON_APP_PASSWORD - same "disabled until an operator sets a secret"
 * shape as SCHEDULER_ADMIN_KEY (routes/scheduler.ts), so every existing
 * self-hosted instance that hasn't set this keeps today's exact behavior
 * (no login at all).
 *
 * Option B (see khameleon-decisions-log.md, 2026-10-03): real per-user
 * accounts, layered on TOP of this same session mechanism rather than a
 * second, separate one - a session now optionally carries a real `userId`.
 * The moment any row exists in the new `users` table (accounts.ts's
 * accountsEnabled()), appAuthGate requires a real per-user login instead of
 * the shared password - Option A keeps working completely unchanged for
 * every instance that never creates an account.
 *
 * Sessions are an in-memory Map, not signed tokens or JWTs: this is a
 * single-process app (SELF_HOSTING.md), so there's no multi-replica
 * concern, and a server restart simply requires logging in again - an
 * accepted trade-off for this minimal option, not an oversight.
 */

import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { accountsEnabled } from "./accounts.js";

export const SESSION_COOKIE = "khameleon_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface SessionRecord {
  expiresAt: number;
  /** Present only for a real per-user login (Option B); absent for a shared-password-only login (Option A). */
  userId?: number;
}

const sessions = new Map<string, SessionRecord>();

/** Constant-time regardless of input length - both sides are always hashed to a fixed 32 bytes first. */
function safeCompare(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

function configuredPassword(): string {
  return process.env.KHAMELEON_APP_PASSWORD ?? "";
}

/** False (the default) means the app is open to anyone who reaches it - exactly today's behavior, unchanged unless an operator sets the env var. */
export function isAppAuthConfigured(): boolean {
  return configuredPassword().trim().length > 0;
}

export function verifyPassword(candidate: string): boolean {
  const expected = configuredPassword();
  if (!expected) return false;
  return safeCompare(candidate, expected);
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(id);
  }
}

export function createSession(userId?: number): string {
  pruneExpired();
  const id = crypto.randomBytes(32).toString("base64url");
  sessions.set(id, { expiresAt: Date.now() + SESSION_TTL_MS, userId });
  return id;
}

export function getSession(id: string | undefined): SessionRecord | undefined {
  if (!id) return undefined;
  const session = sessions.get(id);
  if (!session) return undefined;
  if (session.expiresAt < Date.now()) {
    sessions.delete(id);
    return undefined;
  }
  return session;
}

export function isValidSession(id: string | undefined): boolean {
  return !!getSession(id);
}

/** The current request's logged-in user id, if accounts mode produced this session - undefined for an Option-A (shared-password-only) session or no session at all. */
export function currentUserId(req: Request): number | undefined {
  const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
  return getSession(sessionId)?.userId;
}

export function destroySession(id: string | undefined): void {
  if (id) sessions.delete(id);
}

// Paths (relative to the /api mount) reachable without a session - just
// enough to check login status and to log in/sign up/out. Everything else
// behind /api requires a valid session the moment either KHAMELEON_APP_PASSWORD
// or a real account (Option B) is active.
const PUBLIC_PATHS = new Set(["/auth/session", "/auth/session/logout", "/auth/signup", "/health", "/healthz"]);

export async function appAuthGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (PUBLIC_PATHS.has(req.path)) {
    next();
    return;
  }

  // Option B wins the moment any account exists - a real per-user login is
  // strictly more capable than the shared password, so once an instance has
  // accounts, that's the only way in, regardless of KHAMELEON_APP_PASSWORD.
  // Fails closed (denies the request) if the accounts check itself errors -
  // same posture as crypto.ts's "missing secret disables the feature rather
  // than silently doing the less-safe thing," applied to a DB error here.
  let hasAccounts: boolean;
  try {
    hasAccounts = await accountsEnabled();
  } catch (err) {
    req.log?.error({ err }, "appAuthGate: accountsEnabled() check failed");
    res.status(503).json({ error: "Auth check failed." });
    return;
  }
  if (hasAccounts) {
    if (currentUserId(req) === undefined) {
      res.status(401).json({ error: "Not logged in. This Khameleon instance requires an account." });
      return;
    }
    next();
    return;
  }

  if (!isAppAuthConfigured()) {
    next();
    return;
  }
  const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!isValidSession(sessionId)) {
    res.status(401).json({ error: "Not logged in. This Khameleon instance requires a password." });
    return;
  }
  next();
}
