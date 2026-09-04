const BASE = import.meta.env.VITE_API_URL || '/api';

export interface InboxItem {
  id: string | number;
  source: string;
  sourceIcon: string;
  sender: string;
  subject: string;
  summary: string;
  priority: string;
  classification: string;
  aiRecommendation: string;
  relatedProject: string;
  priorityScore: number;
  isRead: boolean;
  isArchived: boolean;
  createdAt: string;
}

export interface InboxResponse {
  items: InboxItem[];
  /** 'local' means PATCH below will actually work - gmail/outlook ids are opaque provider strings that never match a local DB row. */
  source: 'gmail' | 'outlook' | 'local';
}

/** Reads degrade to empty on failure - an empty inbox and an unreachable backend look the same, honestly. */
export async function getInbox(): Promise<InboxResponse> {
  try {
    const res = await fetch(`${BASE}/inbox`);
    if (!res.ok) return { items: [], source: 'local' };
    return res.json();
  } catch {
    return { items: [], source: 'local' };
  }
}

/** Only meaningful when the list came from source: 'local' - see InboxResponse. Throws on failure. */
export async function updateInboxItem(id: string | number, patch: { isRead?: boolean; isArchived?: boolean }): Promise<InboxItem> {
  const res = await fetch(`${BASE}/inbox/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? `Failed to update inbox item (HTTP ${res.status})`);
  }
  return res.json();
}
