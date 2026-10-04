/**
 * Client for GET /api/quota — real per-minute rate-limit snapshots
 * Anthropic/OpenAI return on their own API responses. See
 * providerQuota.ts server-side for exactly what this is (a short-term
 * rate-limit window) and isn't (overall spend/budget, which neither
 * provider exposes via API).
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

export interface QuotaSnapshot {
  requestsLimit?: number;
  requestsRemaining?: number;
  tokensLimit?: number;
  tokensRemaining?: number;
  capturedAt: string;
}

export type QuotaSnapshots = Partial<Record<'anthropic' | 'openai', QuotaSnapshot>>;

export async function getQuotaSnapshots(): Promise<QuotaSnapshots> {
  const res = await fetch(`${BASE}/quota`);
  if (!res.ok) throw new Error('Could not load quota data');
  return res.json();
}
