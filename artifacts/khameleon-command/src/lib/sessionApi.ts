/**
 * Client for the shared-password gate (account isolation, Option A —
 * khameleon-decisions-log.md, 2026-10-01). Same-origin only by design —
 * this gate targets the self-hosted single-origin deployment
 * (WEB_DIST_PATH), not the split-port local dev setup, so no special
 * credentials handling is needed: fetch() already sends same-origin
 * cookies by default.
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

export interface SessionStatus {
  authRequired: boolean;
  authenticated: boolean;
}

export async function getSessionStatus(): Promise<SessionStatus> {
  const res = await fetch(`${BASE}/auth/session`);
  if (!res.ok) throw new Error('Could not check login status');
  return res.json();
}

export async function login(password: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || 'Login failed');
  }
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/session/logout`, { method: 'POST' });
}
