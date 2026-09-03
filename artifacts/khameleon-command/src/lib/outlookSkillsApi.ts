/**
 * Client for the real outlook-draft-email skill (design-spec.md §12.1) —
 * distinct from approvalsApi.ts's generic mock demo. This hits real
 * Microsoft Graph-backed endpoints (routes/outlookSkills.ts).
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

export interface OutlookDraft {
  approvalId: number;
  taskRunId: string;
  draftId: string;
  to: string;
  subject: string;
  body: string;
}

async function asJson<T>(response: Response, action: string): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `${action} failed (HTTP ${response.status})`);
  }
  return response.json() as Promise<T>;
}

/** Steps 1-4: fetch thread, summarize, compose, create draft. Never sends. */
export async function runOutlookDraftEmail(messageId: string): Promise<OutlookDraft> {
  const response = await fetch(`${BASE}/skills/outlook-draft-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId }),
  });
  return asJson<OutlookDraft>(response, 'Draft request');
}

/** Step 5: the actual Mail.Send call — fired only on explicit confirmation. */
export async function sendOutlookDraft(approvalId: number, editedBody?: string): Promise<{ ok: true; sentAt: string }> {
  const response = await fetch(`${BASE}/skills/outlook-draft-email/${approvalId}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editedBody }),
  });
  return asJson(response, 'Send');
}

/** Discards the draft (and best-effort deletes it from Outlook) without sending. */
export async function rejectOutlookDraft(approvalId: number): Promise<{ ok: true }> {
  const response = await fetch(`${BASE}/skills/outlook-draft-email/${approvalId}/reject`, {
    method: 'POST',
  });
  return asJson(response, 'Reject');
}
