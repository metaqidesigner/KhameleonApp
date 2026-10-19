/** Build 5 (artifacts/api-server/src/routes/procedures.ts). */
const BASE = import.meta.env.VITE_API_URL || '/api';

export interface ProcedureDocSummary {
  id: number; workDomainId: number; name: string; fileName: string; confidential: boolean;
  sections: { id: string; heading: string }[]; characters: number; updatedAt: string;
}
export type FlagKind = 'missing' | 'extra' | 'order' | 'contradicts';
export interface CheckStep { n: number; text: string; match?: { procStep: number; quote: string }; flags: { kind: FlagKind; note: string; quote?: string; lessCertain?: boolean }[] }
export interface ProcedureCheck {
  skillSetId: number; documentId: number | null; sectionId: string | null;
  status: 'matches' | 'differs' | 'no_procedure'; firstDifference: number | null; lessCertain: boolean; needsReview: boolean; checkedAt: string;
  result: {
    reason?: string; documentName?: string; sectionHeading?: string;
    steps?: CheckStep[]; missing?: { procStep: number; quote: string; afterStep: number }[]; procedure?: string[];
  };
}
export interface SkillDraftFromDocument { name: string; description: string; steps: string; by: string; documentId: number; sectionId: string; documentName: string; sectionHeading: string }

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/procedures${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Request failed (HTTP ${res.status})`);
  return json as T;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Couldn\'t read that file'));
    r.readAsDataURL(file);
  });
}

export const listProcedureDocs = (workDomainId?: number) => call<ProcedureDocSummary[]>('GET', `/documents${workDomainId ? `?workDomainId=${workDomainId}` : ''}`);
export const getProcedureDoc = (id: number) => call<ProcedureDocSummary & { sections: { id: string; heading: string; text: string }[] }>('GET', `/documents/${id}`);
export async function addProcedureDoc(workDomainId: number, file: File, confidential: boolean) {
  return call<ProcedureDocSummary & { readBy: 'text' | 'ocr' }>('POST', '/documents', { workDomainId, fileName: file.name, dataBase64: await toBase64(file), confidential });
}
export async function replaceProcedureDoc(id: number, file: File) {
  return call<ProcedureDocSummary & { readBy: 'text' | 'ocr' }>('POST', '/documents', { replaceId: id, fileName: file.name, dataBase64: await toBase64(file) });
}
export const updateProcedureDoc = (id: number, patch: { name?: string; confidential?: boolean }) => call<ProcedureDocSummary>('PATCH', `/documents/${id}`, patch);
export const deleteProcedureDoc = (id: number) => call<{ deleted: boolean }>('DELETE', `/documents/${id}`);
export const listProcedureChecks = () => call<ProcedureCheck[]>('GET', '/checks');
export const recheckSkill = (skillId: number) => call<ProcedureCheck>('POST', `/check/${skillId}`);
export const draftSkillFromDocument = (documentId: number, sectionId: string) => call<SkillDraftFromDocument>('POST', '/draft-skill', { documentId, sectionId });
export const suggestDomain = (input: { name: string; description: string; steps: string }) => call<{ workDomainId: number | null; reason: string | null }>('POST', '/suggest-domain', input);
