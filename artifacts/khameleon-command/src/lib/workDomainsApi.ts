const BASE = import.meta.env.VITE_API_URL || '/api';

export interface WorkDomain {
  id: number;
  name: string;
  description: string;
  isBuiltIn: boolean;
  createdAt: string;
}

/** Reads degrade to empty on failure - a missing catalog and an unreachable backend look the same, honestly. */
export async function getWorkDomains(): Promise<WorkDomain[]> {
  try {
    const res = await fetch(`${BASE}/work-domains`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Mutations throw on failure - a created/renamed/deleted domain is a real, checkable outcome. */
async function mutate<T>(path: string, opts: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? `Request failed (HTTP ${res.status})`);
  }
  return res.json();
}

export function createWorkDomain(name: string, description?: string): Promise<WorkDomain> {
  return mutate('/work-domains', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
}

export function renameWorkDomain(id: number, name: string, description?: string): Promise<WorkDomain> {
  return mutate(`/work-domains/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description }),
  });
}

export function deleteWorkDomain(id: number): Promise<{ ok: boolean }> {
  return mutate(`/work-domains/${id}`, { method: 'DELETE' });
}

export function setEntityWorkDomains(
  entityType: 'skill_set' | 'integration',
  entityId: string,
  workDomainIds: number[],
): Promise<{ ok: boolean; workDomainIds: number[] }> {
  return mutate(`/work-domains/entity/${entityType}/${entityId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workDomainIds }),
  });
}
