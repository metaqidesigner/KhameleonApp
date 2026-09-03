const BASE = import.meta.env.VITE_API_URL || '/api';

export interface IntegrationEntry {
  id: string;
  name: string;
  dataScope: string;
  actionScope: string;
  reversible: boolean;
  sourceType: 'directory' | 'openapi' | 'mcp' | 'manifest';
  sourceUrl: string | null;
  sourceAuthor: string | null;
  providerId: string | null;
  createdAt: string;
  connected: boolean;
  workDomainIds: number[];
}

/** Reads degrade to empty on failure - matches every other directory listing in this app. */
export async function getIntegrations(): Promise<IntegrationEntry[]> {
  try {
    const res = await fetch(`${BASE}/integrations`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/**
 * Disconnect goes through the existing real OAuth route (routes/auth.ts),
 * not a new integrations-specific endpoint - one place owns the token
 * lifecycle. Throws on failure; always immediate per §16.5 (no gate).
 */
export async function disconnectIntegration(providerId: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/auth/oauth/${providerId}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? `Failed to disconnect (HTTP ${res.status})`);
  }
  return res.json();
}

/** The real OAuth start path for a connected provider - redirect target only, not fetched. */
export function connectStartPath(providerId: string): string {
  return `${BASE}/auth/oauth/${providerId}/start`;
}
