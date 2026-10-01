/**
 * Account isolation, Option A (see khameleon-decisions-log.md, 2026-10-01):
 * one shared password in front of the whole app, opt-in via
 * KHAMELEON_APP_PASSWORD - same "disabled until an operator sets a secret"
 * shape as SCHEDULER_ADMIN_KEY (routes/scheduler.ts), so every existing
 * self-hosted instance that hasn't set this keeps today's exact behavior
 * (no login at all). Real per-account data isolation (separate users each
 * seeing only their own tasks/vault/etc.) is Option B - a genuinely
 * different, much larger feature - deliberately deferred until needed.
 *
 * Sessions are an in-memory Map, not signed tokens or JWTs: this is a
 * single-process app (SELF_HOSTING.md), so there's no multi-replica
 * concern, and a server restart simply requires logging in again - an
 * accepted trade-off for this minimal option, not an oversight.
 */

import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const SESSION_COOKIE = "khameleon_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const sessions = new Map<string, { expiresAt: number }>();

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

export function createSession(): string {
  pruneExpired();
  const id = crypto.randomBytes(32).toString("base64url");
  sessions.set(id, { expiresAt: Date.now() + SESSION_TTL_MS });
  return id;
}

export function isValidSession(id: string | undefined): boolean {
  if (!id) return false;
  const session = sessions.get(id);
  if (!session) return false;
  if (session.expiresAt < Date.now()) {
    sessions.delete(id);
    return false;
  }
  return true;
}

export function destroySession(id: string | undefined): void {
  if (id) sessions.delete(id);
}

// Paths (relative to the /api mount) reachable without a session - just
// enough to check login status and to log in/out. Everything else behind
// /api requires a valid session the moment KHAMELEON_APP_PASSWORD is set.
const PUBLIC_PATHS = new Set(["/auth/session", "/auth/session/logout", "/health", "/healthz"]);

export function appAuthGate(req: Request, res: Response, next: NextFunction): void {
  if (!isAppAuthConfigured()) {
    next();
    return;
  }
  if (PUBLIC_PATHS.has(req.path)) {
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
