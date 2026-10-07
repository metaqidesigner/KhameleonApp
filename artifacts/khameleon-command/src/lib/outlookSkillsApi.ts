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

/** Re-composes the draft with a different tone, per a spoken instruction - one real re-compose pass, written back to both the Outlook draft and the approval row. */
export async function rewriteOutlookDraft(approvalId: number, toneInstruction?: string): Promise<OutlookDraft> {
  const response = await fetch(`${BASE}/skills/outlook-draft-email/${approvalId}/rewrite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ toneInstruction }),
  });
  return asJson<OutlookDraft>(response, 'Rewrite');
}

/** Discards the draft (and best-effort deletes it from Outlook) without sending. */
export async function rejectOutlookDraft(approvalId: number): Promise<{ ok: true }> {
  const response = await fetch(`${BASE}/skills/outlook-draft-email/${approvalId}/reject`, {
    method: 'POST',
  });
  return asJson(response, 'Reject');
}

export interface OutlookThreadSummary {
  taskRunId: string;
  summary: string;
  participants: string[];
  messageCount: number;
}

/**
 * §12.2 — pipeline-only, no confirm gate: reading and summarizing a thread
 * is local/cheap/reversible (§6.5.3), so this runs to completion in one call.
 */
export async function runOutlookSummarizeThread(messageId: string): Promise<OutlookThreadSummary> {
  const response = await fetch(`${BASE}/skills/outlook-summarize-thread`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId }),
  });
  return asJson<OutlookThreadSummary>(response, 'Summarize request');
}

export type TriageClassification = 'urgent' | 'action_needed' | 'fyi' | 'low_priority';

export interface TriageUndoEntry {
  currentId: string;
  originalId: string;
  wasArchived: boolean;
  previousCategories: string[];
  previousFlagStatus: string;
}

export interface TriageItem {
  id: string;
  subject: string;
  from: string;
  classification: TriageClassification;
  source: 'rule' | 'judgment';
  actionTaken: string;
  undo: TriageUndoEntry;
}

/** An extracted action item, plus the real Task row created for it (if creation succeeded). */
export interface TriageActionItem {
  text: string;
  taskId: number | null;
  sourceMessageId: string;
}

export interface TriageResult {
  taskRunId: string;
  items: TriageItem[];
  actionItems: TriageActionItem[];
  counts: Record<TriageClassification, number>;
}

/**
 * §12.3 — hybrid, no confirm gate: flagging/categorizing/archiving the
 * user's own mail is local/cheap/reversible (§6.5.3). Real undo is offered
 * on the resulting receipt instead (§6.5.2) — see undoOutlookTriage.
 */
export async function runOutlookTriageInbox(): Promise<TriageResult> {
  const response = await fetch(`${BASE}/skills/outlook-triage-inbox`, { method: 'POST' });
  return asJson<TriageResult>(response, 'Triage request');
}

/** taskIds: also deletes the Task rows the run created, so undo doesn't leave orphaned tasks behind. */
export async function undoOutlookTriage(
  entries: TriageUndoEntry[],
  taskIds: number[] = []
): Promise<{ ok: boolean; restored: number; failed: number; tasksDeleted: number }> {
  const response = await fetch(`${BASE}/skills/outlook-triage-inbox/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries, taskIds }),
  });
  return asJson(response, 'Undo');
}

export interface OutlookMessagePreview {
  id: string;
  subject: string;
  from: string;
  preview: string;
  receivedDateTime: string;
}

/** Lets the user pick a real message instead of pasting a raw Graph id. */
export async function listOutlookMessages(): Promise<OutlookMessagePreview[]> {
  const response = await fetch(`${BASE}/skills/outlook-messages`);
  return asJson<OutlookMessagePreview[]>(response, 'List messages');
}
