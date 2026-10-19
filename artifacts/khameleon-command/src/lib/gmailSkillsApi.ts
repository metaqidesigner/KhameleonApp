/**
 * Client for the real gmail-draft-email skill — mirrors
 * outlookSkillsApi.ts exactly. Closes the "Gmail is read-only" gap
 * (2026-10-01 function audit) by hitting real Gmail-backed endpoints
 * (routes/gmailSkills.ts, routes/gmailMessages.ts).
 */
const BASE = import.meta.env.VITE_API_URL || '/api';

export interface GmailDraft {
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
export async function runGmailDraftEmail(messageId: string): Promise<GmailDraft> {
  const response = await fetch(`${BASE}/skills/gmail-draft-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId }),
  });
  return asJson<GmailDraft>(response, 'Draft request');
}

/** Step 5: the actual gmail.send call — fired only on explicit confirmation. */
export async function sendGmailDraft(approvalId: number, editedBody?: string): Promise<{ ok: true; sentAt: string }> {
  const response = await fetch(`${BASE}/skills/gmail-draft-email/${approvalId}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editedBody }),
  });
  return asJson(response, 'Send');
}

/** Re-composes the draft with a different tone, per a spoken instruction - one real re-compose pass, written back to both the Gmail draft and the approval row. */
export async function rewriteGmailDraft(approvalId: number, toneInstruction?: string): Promise<GmailDraft> {
  const response = await fetch(`${BASE}/skills/gmail-draft-email/${approvalId}/rewrite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toneInstruction }),
  });
  return asJson<GmailDraft>(response, 'Rewrite');
}

/** Discards the draft (and best-effort deletes it from Gmail) without sending. */
export async function rejectGmailDraft(approvalId: number): Promise<{ ok: true }> {
  const response = await fetch(`${BASE}/skills/gmail-draft-email/${approvalId}/reject`, {
    method: 'POST',
  });
  return asJson(response, 'Reject');
}

export interface GmailMessagePreview {
  id: string;
  subject: string;
  from: string;
  preview: string;
  receivedDateTime: string;
}

/** Lets the user pick a real message instead of pasting a raw Gmail id. */
export async function listGmailMessages(): Promise<GmailMessagePreview[]> {
  const response = await fetch(`${BASE}/skills/gmail-messages`);
  return asJson<GmailMessagePreview[]>(response, 'List messages');
}

/** Build 11: sorting the Gmail inbox - same shape as Outlook's sort, with Gmail's own undo details. */
export interface GmailTriageResult {
  items: { id: string; subject: string; from: string; classification: 'urgent' | 'action_needed' | 'fyi' | 'low_priority'; actionTaken: string; undo: unknown }[];
  actionItems: { text: string; taskId: number | null; sourceMessageId: string }[];
  counts: Record<'urgent' | 'action_needed' | 'fyi' | 'low_priority', number>;
}
export async function runGmailTriageInbox(): Promise<GmailTriageResult> {
  return asJson<GmailTriageResult>(await fetch(`${BASE}/skills/gmail-triage-inbox`, { method: 'POST' }), 'Sort request');
}
export async function undoGmailTriage(entries: unknown[], taskIds: number[] = []): Promise<{ restored: number; failed: number }> {
  return asJson(await fetch(`${BASE}/skills/gmail-triage-inbox/undo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries, taskIds }) }), 'Undo request');
}
