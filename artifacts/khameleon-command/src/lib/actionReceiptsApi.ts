const BASE = import.meta.env.VITE_API_URL || '/api';

export interface ActionReceiptData {
  id: number;
  description: string;
  category: string;
  scope: string;
  outcome: 'success' | 'failure' | 'pending' | 'needs_review';
  target: string | null;
  canUndo: boolean;
  undone: boolean;
  relatedApprovalId: number | null;
  createdAt: string;
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
