/** Khami step 5 (artifacts/api-server/src/routes/escalation.ts). */
const BASE = import.meta.env.VITE_API_URL || '/api';

export type EscalationMode = 'ask' | 'auto' | 'never';
export interface EscalationCheck {
  confidential: boolean;
  reasons: string[];
  tricky: boolean;
  reason: string | null;
  offer: { id: string; name: string } | null;
  mode: EscalationMode;
}

/** Instant (plain code on the server). On any failure: nothing to offer, not confidential - the server still enforces the lock. */
export async function checkEscalation(messages: { role: string; content: string }[], agentId: string, confidential: boolean): Promise<EscalationCheck> {
  try {
    const res = await fetch(`${BASE}/escalation/check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, agentId, confidential }) });
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return { confidential, reasons: confidential ? ['you marked it confidential'] : [], tricky: false, reason: null, offer: null, mode: 'ask' };
  }
}

export async function getEscalationMode(): Promise<EscalationMode> {
  const res = await fetch(`${BASE}/escalation/settings`);
  const j = await res.json().catch(() => ({ mode: 'ask' }));
  return j.mode ?? 'ask';
}

export async function setEscalationMode(mode: EscalationMode): Promise<EscalationMode> {
  const res = await fetch(`${BASE}/escalation/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) });
  if (!res.ok) throw new Error('Couldn\'t save the setting');
  return (await res.json()).mode;
}
