const BASE = import.meta.env.VITE_API_URL || '/api';

export type SkillSetStatus = 'available' | 'pending' | 'installed' | 'uninstalled';
export type SkillSetSourceType = 'authored' | 'github' | 'url' | 'marketplace';

export interface SkillSet {
  id: number;
  name: string;
  description: string;
  content: string;
  sourceType: SkillSetSourceType;
  sourceUrl: string | null;
  sourceAuthor: string | null;
  sourceUpdatedAt: string | null;
  requestedTools: string[];
  requestedIntegrationIds: string[];
  version: string;
  status: SkillSetStatus;
  installedAt: string | null;
  createdAt: string;
  workDomainIds: number[];
  /** Only set when status === 'pending' - the approval id to resolve on confirm. */
  pendingApprovalId: number | null;
}

export interface CreateSkillSetInput {
  name: string;
  description?: string;
  content?: string;
  sourceType?: SkillSetSourceType;
  sourceUrl?: string;
  sourceAuthor?: string;
  sourceUpdatedAt?: string;
  requestedTools?: string[];
  requestedIntegrationIds?: string[];
  workDomainIds?: number[];
}

export interface CreateSkillSetResult {
  skillSet: SkillSet;
  /** Set when this install requires a hard confirm gate (design-spec.md §15.3/§15.5). */
  approvalId: number | null;
}

/** Reads degrade to empty on failure - an empty catalog and an unreachable backend look the same, honestly. */
export async function getSkillSets(): Promise<SkillSet[]> {
  try {
    const res = await fetch(`${BASE}/skill-sets`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function mutate<T>(path: string, opts: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? `Request failed (HTTP ${res.status})`);
  }
  return res.json();
}

/**
 * Create or import a Skill Set. Throws on failure - installing (or
 * requesting an install) is a mutation with a real outcome. The server,
 * not this function, decides whether the result needs a confirm gate -
 * see the doc comment on requiresHardGate() in the backend.
 */
export function createSkillSet(input: CreateSkillSetInput): Promise<CreateSkillSetResult> {
  return mutate('/skill-sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function confirmSkillSetInstall(id: number, approvalId: number | null): Promise<SkillSet> {
  return mutate(`/skill-sets/${id}/confirm-install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvalId }),
  });
}

/** Always immediate per §15.4 - no gate, but still throws on a real failure. */
export function uninstallSkillSet(id: number): Promise<SkillSet> {
  return mutate(`/skill-sets/${id}/uninstall`, { method: 'POST' });
}

/**
 * Installs an existing catalog entry (status 'available') - a starter
 * Skill Set, or one accepted from a §15.2 contextual suggestion. Same
 * gating result shape as createSkillSet(): a null approvalId means it's
 * already installed; a real one means confirmSkillSetInstall() is next.
 */
export function installSkillSetFromCatalog(id: number): Promise<CreateSkillSetResult> {
  return mutate(`/skill-sets/${id}/install`, { method: 'POST' });
}

export interface UpdateSkillSetResult {
  skillSet: SkillSet;
  approvalId: number | null;
  pendingScope?: { requestedTools: string[]; requestedIntegrationIds: string[] };
}

export function updateSkillSet(
  id: number,
  patch: { content?: string; requestedTools?: string[]; requestedIntegrationIds?: string[] },
): Promise<UpdateSkillSetResult> {
  return mutate(`/skill-sets/${id}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function confirmSkillSetUpdate(
  id: number,
  approvalId: number | null,
  requestedTools: string[],
  requestedIntegrationIds: string[],
): Promise<SkillSet> {
  return mutate(`/skill-sets/${id}/confirm-update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvalId, requestedTools, requestedIntegrationIds }),
  });
}
