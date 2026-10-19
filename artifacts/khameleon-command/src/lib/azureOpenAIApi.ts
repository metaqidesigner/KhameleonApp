/** Settings > AI > Azure OpenAI (artifacts/api-server/src/routes/azureOpenAI.ts). */
const BASE = import.meta.env.VITE_API_URL || '/api';
export interface AzureStatus { configured: boolean; endpoint: string | null; deployment: string | null; canEdit: boolean }
export interface AzureInput { endpoint: string; deployment: string; apiKey: string }

async function call<T>(method: string, path = '', body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/settings/azure-openai${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (HTTP ${res.status})`);
  return json as T;
}
export const getAzureStatus = () => call<AzureStatus>('GET');
export const saveAzure = (i: AzureInput) => call<{ saved: boolean }>('PUT', '', i);
export const clearAzure = () => call<{ cleared: boolean }>('DELETE');
export const testAzure = (i?: AzureInput) => call<{ ok: boolean; message: string }>('POST', '/test', i ?? {});
