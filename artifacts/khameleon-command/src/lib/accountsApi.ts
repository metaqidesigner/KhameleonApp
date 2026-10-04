/**
 * Admin-only account management client (hosted/managed mode, Phase 4 —
 * khameleon-decisions-log.md, 2026-10-03). Only meaningful once accounts
 * mode is active — see sessionApi.ts for the login/signup/session surface.
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

export interface Account {
  id: number;
  email: string;
  displayName: string;
  role: string;
  isAdmin: boolean;
  active: boolean;
  createdAt: string;
}

async function asJson<T>(res: Response, fallbackError: string): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || fallbackError);
  }
  return res.json() as Promise<T>;
}

export async function listAccounts(): Promise<Account[]> {
  return asJson<Account[]>(await fetch(`${BASE}/users`), 'Could not list accounts');
}

export async function setAccountActive(id: number, active: boolean): Promise<Account> {
  return asJson<Account>(await fetch(`${BASE}/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  }), 'Could not update account');
}
