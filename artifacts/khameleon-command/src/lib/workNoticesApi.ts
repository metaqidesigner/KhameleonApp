/** The suggestion slot and alert settings (artifacts/api-server/src/routes/workNotices.ts). */
const BASE = import.meta.env.VITE_API_URL || '/api';
export interface Suggestion { id: number; kind: 'meeting_brief' | 'urgent_mail' | string; title: string; body: string; why: string; createdAt: string }
export interface PrepSettings { enabled: boolean; leadMinutes: number }

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/work${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (HTTP ${res.status})`);
  return json as T;
}
export const getSuggestions = () => call<Suggestion[]>('GET', '/suggestions');
export const dismissSuggestion = (id: number) => call('POST', `/suggestions/${id}/dismiss`);
export const openedSuggestion = (id: number) => call('POST', `/suggestions/${id}/opened`);
export const getPrepSettings = () => call<PrepSettings>('GET', '/meeting-prep/settings');
export const setPrepSettings = (p: Partial<PrepSettings>) => call<PrepSettings>('PUT', '/meeting-prep/settings', p);

export type AlertMode = 'regular' | 'on_request' | 'off';
export interface UrgentAlertSettings { mode: AlertMode; maxPerDay: number; quietStart: number; quietEnd: number }
export const getUrgentAlertSettings = () => call<UrgentAlertSettings>('GET', '/urgent-alerts/settings');
export const setUrgentAlertSettings = (p: Partial<UrgentAlertSettings>) => call<UrgentAlertSettings>('PUT', '/urgent-alerts/settings', p);
