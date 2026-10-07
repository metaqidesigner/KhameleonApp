/**
 * Client for the real Mobile Morning Briefing endpoint (api-server's
 * briefing.ts/routes/briefing.ts). Types mirror the server's exactly.
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

export interface BriefingDraft {
  provider: 'outlook' | 'gmail';
  approvalId: number;
  to: string;
  subject: string;
  body: string;
  supportsRewrite: boolean;
}

export interface BriefingUrgentItem {
  kind: 'task' | 'awaiting_confirmation' | 'drafted_reply';
  id: string;
  title: string;
  detail?: string;
  draft?: BriefingDraft;
}

export interface BriefingFyiItem {
  id: string;
  subject: string;
  from: string;
  actionTaken: string;
}

export interface BriefingHeadsUpItem {
  id: string;
  title: string;
  detail?: string;
}

export interface MorningBriefing {
  generatedAt: string;
  urgent: BriefingUrgentItem[];
  fyi: BriefingFyiItem[];
  headsUp: BriefingHeadsUpItem[];
  emailConnected: { outlook: boolean; gmail: boolean };
}

export async function getMorningBriefing(): Promise<MorningBriefing> {
  const response = await fetch(`${BASE}/briefing/today`);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Briefing request failed (HTTP ${response.status})`);
  }
  return response.json() as Promise<MorningBriefing>;
}

/**
 * Records one real turn of this briefing run so the desktop Chat Window
 * can resume it later as a real conversation (see routes/briefing.ts).
 * Fire-and-forget by design, matching agents/store.ts's existing
 * "persistence failure shouldn't interrupt the live interaction" pattern -
 * a failed log call should never block narration or a send/skip action.
 */
export async function logBriefingTurn(sessionId: string, role: 'user' | 'assistant', content: string): Promise<void> {
  try {
    await fetch(`${BASE}/briefing/session/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, role, content }),
    });
  } catch {
    // Intentionally swallowed - see docblock above.
  }
}
