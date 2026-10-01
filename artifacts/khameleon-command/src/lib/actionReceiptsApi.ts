const BASE = import.meta.env.VITE_API_URL || '/api';

export interface ActionReceiptData {
  id: number;
  description: string;
  category: string;
  scope: string;
  outcome: 'success' | 'failure' | 'pending' | 'needs_review';
  target: string | null;
  detail: string | null;
  canUndo: boolean;
  undone: boolean;
  relatedApprovalId: number | null;
  createdAt: string;
}

export interface CreateActionReceiptInput {
  description: string;
  category: string;
  scope: string;
  outcome?: 'success' | 'failure' | 'pending' | 'needs_review';
  target?: string | null;
  detail?: string | null;
  canUndo?: boolean;
  relatedApprovalId?: number | null;
}

/** The durable receipts feed (design-spec.md §6.5.2) - reads degrade to empty on failure. */
export async function getActionReceipts(): Promise<ActionReceiptData[]> {
  try {
    const res = await fetch(`${BASE}/action-receipts`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/**
 * Persists a real receipt - closes the 2026-10-01 audit gap where the real
 * outlook-draft-email send only ever updated local React state. Throws on
 * failure (unlike the read above) so a caller mid-action knows the record
 * didn't actually save, rather than silently losing it.
 */
export async function createActionReceipt(input: CreateActionReceiptInput): Promise<ActionReceiptData> {
  const res = await fetch(`${BASE}/action-receipts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to save action receipt');
  return res.json();
}
