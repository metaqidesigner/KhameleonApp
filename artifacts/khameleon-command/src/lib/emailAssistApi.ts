/** Email assistant (artifacts/api-server/src/routes/emailAssist.ts). */
const BASE = import.meta.env.VITE_API_URL || '/api';

export type EmailSource = 'outlook' | 'gmail';
export interface EmailAssistStatus { khami: boolean; copilot: boolean; outlook: boolean; gmail: boolean }
export interface FoundEmail { source: EmailSource; id: string; subject: string; from: string; fromName: string; unread: boolean; isPerson: boolean; receivedAt?: string }
export interface AssistAction { kind: 'task' | 'calendar' | 'other'; label: string }
export interface AssistResult { summary: string; reply: string; actions: AssistAction[]; by: string; email: { subject: string; from: string } }

/** Which email to help with: one found through Outlook/Gmail, or text the desktop app read. */
export type EmailRef = { source: EmailSource; id: string } | { email: { subject: string; from: string; body: string } };

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/email-assist${path}`, body === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (HTTP ${res.status})`);
  return json as T;
}

export const getEmailAssistStatus = () => call<EmailAssistStatus>('/status');
export const findEmail = (input: { client: string; subject: string; sender?: string }) => call<{ found: FoundEmail | null }>('/find', input).then(r => r.found);
export const helpWithEmail = (ref: EmailRef, agent?: 'copilot') => call<AssistResult>('/help', { ...ref, agent });
export const rewriteReply = (ref: EmailRef, reply: string, how: string, agent?: 'copilot') => call<{ reply: string }>('/rewrite', { ...ref, reply, how, agent }).then(r => r.reply);
export const saveReplyDraft = (source: EmailSource, id: string, reply: string) => call<{ saved: boolean; where: string }>('/draft', { source, id, reply });
