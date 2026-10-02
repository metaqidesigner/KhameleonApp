/**
 * Client for both account-isolation options: the shared-password gate
 * (Option A — khameleon-decisions-log.md, 2026-10-01) and real per-user
 * accounts (Option B — 2026-10-03). Same-origin only by design — this gate
 * targets the self-hosted single-origin deployment (WEB_DIST_PATH), not the
 * split-port local dev setup, so no special credentials handling is needed:
 * fetch() already sends same-origin cookies by default.
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

export interface SessionUser {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export interface SessionStatus {
  authRequired: boolean;
  authenticated: boolean;
  /** 'password' = Option A (shared password, no identity); 'accounts' = Option B (real per-user login). */
  mode: 'password' | 'accounts';
  /** Only present when mode is 'accounts' and authenticated is true. */
  user?: SessionUser | null;
}

async function asJson<T>(res: Response, fallbackError: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || fallbackError);
  }
  return res.json() as Promise<T>;
}

export async function getSessionStatus(): Promise<SessionStatus> {
  const res = await fetch(`${BASE}/auth/session`);
  return asJson<SessionStatus>(res, 'Could not check login status');
}

/** Option A: one shared password for the whole instance. */
export async function login(password: string): Promise<void> {
  await asJson(await fetch(`${BASE}/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  }), 'Login failed');
}

/** Option B: a real per-user login. */
export async function loginWithAccount(email: string, password: string): Promise<SessionUser> {
  const data = await asJson<{ user: SessionUser }>(await fetch(`${BASE}/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }), 'Login failed');
  return data.user;
}

/** Creates the first account on an instance with no accounts yet (becomes admin), or — when called by an already-logged-in admin — a new account for someone else. */
export async function signup(email: string, password: string, displayName: string): Promise<SessionUser> {
  const data = await asJson<{ user: SessionUser }>(await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  }), 'Signup failed');
  return data.user;
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/session/logout`, { method: 'POST' });
}
