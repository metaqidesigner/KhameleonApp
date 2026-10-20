/** Settings > Microsoft sign-in (artifacts/api-server/src/routes/microsoftApp.ts). */
const BASE = import.meta.env.VITE_API_URL || '/api';

export interface MicrosoftAppStatus {
  configured: boolean;
  source: 'settings' | 'server' | 'built-in' | null;
  clientId: string | null;
  tenantId: string | null;
  redirectUri: string;
  canEdit: boolean;
}
export interface MicrosoftAppInput { clientId: string; clientSecret: string; tenantId?: string }

async function call<T>(method: string, path = '', body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/settings/microsoft-app${path}`, {
    method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (HTTP ${res.status})`);
  return json as T;
}

export const getMicrosoftAppStatus = () => call<MicrosoftAppStatus>('GET');
export const saveMicrosoftApp = (input: MicrosoftAppInput) => call<{ saved: boolean }>('PUT', '', input);
export const clearMicrosoftApp = () => call<{ cleared: boolean }>('DELETE');
export const testMicrosoftApp = (input?: MicrosoftAppInput) => call<{ ok: boolean; message: string }>('POST', '/test', input ?? {});
