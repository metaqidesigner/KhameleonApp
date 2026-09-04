const BASE = import.meta.env.VITE_API_URL || '/api';

export interface VaultItem {
  id: number;
  name: string;
  category: string;
  permissionLevel: string;
  lastAccessed: string;
  owner: string;
  description: string;
  status: string;
  createdAt: string;
}

export interface VaultAccessLogEntry {
  id: number;
  vaultItemId: number;
  itemName: string;
  action: 'created' | 'viewed' | 'updated' | 'deleted';
  createdAt: string;
}

export interface CreateVaultItemInput {
  name: string;
  category: string;
  permissionLevel?: string;
  owner?: string;
  description?: string;
  secretValue: string;
}

export interface UpdateVaultItemInput {
  name?: string;
  category?: string;
  permissionLevel?: string;
  owner?: string;
  description?: string;
  status?: string;
  secretValue?: string;
}

/** Reads degrade to empty on failure - an empty vault and an unreachable backend look the same, honestly. */
export async function getVaultItems(): Promise<VaultItem[]> {
  try {
    const res = await fetch(`${BASE}/vault`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function getVaultAccessLog(id: number): Promise<VaultAccessLogEntry[]> {
  try {
    const res = await fetch(`${BASE}/vault/${id}/access-log`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function mutate<T>(path: string, opts: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? `Request failed (HTTP ${res.status})`);
  }
  return res.json();
}

/** Creating your own secret - a mutation with a real outcome, throws on failure. */
export function createVaultItem(input: CreateVaultItemInput): Promise<VaultItem> {
  return mutate('/vault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

/**
 * Decrypts and returns the real secret value. Every call is logged
 * server-side (routes/vault.ts) regardless of how the UI presents it.
 */
export function revealVaultItem(id: number): Promise<{ value: string }> {
  return mutate(`/vault/${id}/reveal`, { method: 'GET' });
}

export function updateVaultItem(id: number, patch: UpdateVaultItemInput): Promise<VaultItem> {
  return mutate(`/vault/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

/** Irreversible - throws on failure rather than silently doing nothing. */
export function deleteVaultItem(id: number): Promise<{ ok: true }> {
  return mutate(`/vault/${id}`, { method: 'DELETE' });
}
