const BASE = import.meta.env.VITE_API_URL || '/api';

/** Get skills from GitHub (server: routes/skillSources.ts). */
export interface SkillSource { url: string; label: string }
export type LicenceKind = 'open' | 'restricted' | 'unknown';

export interface RemoteSkill {
  url: string;
  name: string;
  description: string;
  author: string;
  licence: { kind: LicenceKind; label: string };
  textFiles: number;
  programs: number;
  otherFiles: number;
  version: string;
  installedStatus: 'installed' | 'pending' | 'available' | null;
  updateAvailable: boolean;
}

export interface RemoteSkillPreview extends Omit<RemoteSkill, 'installedStatus' | 'updateAvailable'> {
  content: string;
  truncated: boolean;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? `Request failed (HTTP ${res.status})`);
  }
  return res.json();
}

const send = (method: string, body?: unknown) => ({
  method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});

export const getSkillSources = () => fetch(`${BASE}/skill-sources`).then(r => json<SkillSource[]>(r));
export const addSkillSource = (url: string) => fetch(`${BASE}/skill-sources`, send('POST', { url })).then(r => json<SkillSource[]>(r));
export const removeSkillSource = (url: string) => fetch(`${BASE}/skill-sources?url=${encodeURIComponent(url)}`, { method: 'DELETE' }).then(r => json<SkillSource[]>(r));
export const browseSkills = (url: string) => fetch(`${BASE}/skill-sources/browse?url=${encodeURIComponent(url)}`).then(r => json<RemoteSkill[]>(r));
export const previewSkill = (url: string) => fetch(`${BASE}/skill-sources/preview?url=${encodeURIComponent(url)}`).then(r => json<RemoteSkillPreview>(r));
export const installSkillFromGithub = (url: string) =>
  fetch(`${BASE}/skill-sources/install`, send('POST', { url }))
    .then(r => json<{ skillSet: import('./skillSetsApi').SkillSet; approvalId: number | null }>(r));
