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
