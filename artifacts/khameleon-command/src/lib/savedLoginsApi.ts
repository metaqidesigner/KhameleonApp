/** Build 7 (artifacts/api-server/src/routes/savedLogins.ts). */
const BASE = import.meta.env.VITE_API_URL || '/api';
export interface LoginRequest { id: string; vaultItemId: number; loginName: string; skillName: string | null; canAlways: boolean; createdAt: number }
export type LoginChoice = 'once' | 'always' | 'no';

export async function getLoginRequests(): Promise<LoginRequest[]> {
  const res = await fetch(`${BASE}/logins/pending`);
  return res.ok ? res.json() : [];
}
export async function answerLoginRequest(id: string, choice: LoginChoice): Promise<void> {
  await fetch(`${BASE}/logins/${encodeURIComponent(id)}/answer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice }) });
}
export async function setSkillLogin(skillId: number, vaultItemId: number | null): Promise<void> {
  const res = await fetch(`${BASE}/logins/skills/${skillId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vaultItemId }) });
  if (!res.ok) throw new Error('Couldn\'t link the login');
}
