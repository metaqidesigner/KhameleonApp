const BASE = import.meta.env.VITE_API_URL || '/api';

/** Get integrations (server: routes/integrationSources.ts). */
export interface DirectoryIntegration {
  id: string;
  title: string;
  description: string;
  url: string;
  verified: boolean;
  publisher: string;
  needsKey: boolean;
  keyHint?: string;
}

export type ProbeResult =
  | { ok: true; tools: { name: string; description?: string }[] }
  | { ok: false; needsSignIn: boolean; message: string };

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? `Request failed (HTTP ${res.status})`);
  }
  return res.json();
}

const post = (body: unknown) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const searchIntegrations = (q: string) => fetch(`${BASE}/integration-sources/search?q=${encodeURIComponent(q)}`).then(r => json<DirectoryIntegration[]>(r));
export const probeIntegration = (url: string, token?: string) => fetch(`${BASE}/integration-sources/probe`, post({ url, token })).then(r => json<ProbeResult>(r));
export const startIntegrationSignIn = (url: string, name: string) =>
  fetch(`${BASE}/integration-sources/signin`, post({ url, name })).then(r => json<{ signInUrl?: string; connected?: boolean }>(r));
