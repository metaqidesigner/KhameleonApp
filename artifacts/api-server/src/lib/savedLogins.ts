/**
 * Skills use saved logins (docs/build-review.md, Build 7): the skill names a
 * login from the Vault, Khameleon asks before using it ("Once" or "Always
 * for this skill"; some logins can be set to always ask), and the desktop
 * app types it into the sign-in form - the AI never sees the password.
 * Every use goes in the Vault access log and the activity log. A failed
 * sign-in stops the skill and points to Settings > Credentials.
 */
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, settingsTable, vaultItemsTable, vaultAccessLogTable, actionReceiptsTable } from "@workspace/db";
import { decrypt } from "./crypto.js";
import { callDesktop } from "./desktopLink.js";
import { similarity } from "./procedures.js";
import type { CurrentSkill } from "./skillContext.js";

export type LoginChoice = "once" | "always" | "no";
export interface LoginRequest { id: string; vaultItemId: number; loginName: string; skillName: string | null; canAlways: boolean; createdAt: number }

const GRANTS_KEY = "login_grants";
const pending = new Map<string, { req: LoginRequest; resolve: (c: LoginChoice) => void }>();

async function grants(): Promise<Record<string, number[]>> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, GRANTS_KEY)).limit(1).catch(() => [] as never[]);
  try { return row ? JSON.parse(row.value) : {}; } catch { return {}; }
}
async function saveGrants(g: Record<string, number[]>): Promise<void> {
  const value = JSON.stringify(g);
  await db.insert(settingsTable).values({ key: GRANTS_KEY, value }).onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}
const grantKey = (skill: CurrentSkill) => (skill.id ? `skill:${skill.id}` : `name:${skill.name}`);

/** Forget every "Always" for a login (e.g. when it's set to always ask). */
export async function clearGrantsFor(vaultItemId: number): Promise<void> {
  const g = await grants();
  for (const k of Object.keys(g)) g[k] = g[k].filter(id => id !== vaultItemId);
  await saveGrants(g);
}

/** The best-matching saved login for a name the AI used. Pure. */
export function matchLogin<T extends { id: number; name: string }>(items: T[], wanted: string, preferredId?: number | null): T | null {
  if (preferredId) {
    const p = items.find(i => i.id === preferredId);
    if (p && (!wanted || similarity(p.name, wanted) >= 0.3 || p.name.toLowerCase().includes(wanted.toLowerCase()))) return p;
  }
  const w = wanted.trim().toLowerCase();
  const exact = items.find(i => i.name.toLowerCase() === w);
  if (exact) return exact;
  let best: { i: T; s: number } | null = null;
  for (const i of items) {
    const s = Math.max(similarity(i.name, wanted), i.name.toLowerCase().includes(w) && w.length >= 3 ? 0.6 : 0);
    if (!best || s > best.s) best = { i, s };
  }
  return best && best.s >= 0.4 ? best.i : (preferredId ? items.find(i => i.id === preferredId) ?? null : null);
}

export function pendingLoginRequests(): LoginRequest[] {
  for (const [id, p] of pending) if (Date.now() - p.req.createdAt > 3 * 60_000) { pending.delete(id); p.resolve("no"); }
  return [...pending.values()].map(p => p.req);
}

export async function answerLoginRequest(id: string, choice: LoginChoice): Promise<boolean> {
  const p = pending.get(id);
  if (!p) return false;
  pending.delete(id);
  if (choice === "always" && !p.req.canAlways) choice = "once";
  p.resolve(choice);
  return true;
}

function ask(req: Omit<LoginRequest, "id" | "createdAt">): Promise<LoginChoice> {
  const full: LoginRequest = { ...req, id: crypto.randomUUID(), createdAt: Date.now() };
  return new Promise(resolve => {
    pending.set(full.id, { req: full, resolve });
    setTimeout(() => { if (pending.delete(full.id)) resolve("no"); }, 3 * 60_000);
  });
}

/** The chat tool: sign in with a saved login, asking first. Returns a DONE/FAILED line - never the secret. */
export async function signInWithSavedLogin(loginName: string, app: string | undefined, skill: CurrentSkill | null): Promise<string> {
  const items = await db.select().from(vaultItemsTable);
  const item = matchLogin(items, loginName, skill?.loginVaultItemId);
  if (!item) return `FAILED - there's no saved login called "${loginName}". Add it in Settings > Credentials, then try again.`;
  if (item.status !== "active") return `FAILED - the "${item.name}" login is switched off in Settings > Credentials.`;

  const key = skill ? grantKey(skill) : null;
  const always = !item.alwaysAsk && key ? (await grants())[key]?.includes(item.id) : false;
  let choice: LoginChoice = always ? "always" : await ask({ vaultItemId: item.id, loginName: item.name, skillName: skill?.name ?? null, canAlways: !item.alwaysAsk && !!skill });
  if (choice === "no") return `FAILED - you chose not to use the "${item.name}" login, so the skill stopped there.`;
  if (choice === "always" && key && !always) {
    const g = await grants();
    g[key] = [...new Set([...(g[key] ?? []), item.id])];
    await saveGrants(g);
  }

  let secret: string;
  try { secret = decrypt(item.encryptedValue); } catch { return `FAILED - the "${item.name}" login can't be unlocked on this server. Re-enter it in Settings > Credentials.`; }
  const now = new Date().toISOString();
  await db.insert(vaultAccessLogTable).values({ vaultItemId: item.id, itemName: item.name, action: "used" }).catch(() => undefined);
  await db.update(vaultItemsTable).set({ lastAccessed: now }).where(eq(vaultItemsTable.id, item.id)).catch(() => undefined);

  let outcome: string;
  let ok = true;
  try {
    outcome = await callDesktop("sign_in", { loginName: item.name, username: item.username, secret, app: app ?? "" }, 60_000);
    ok = !/^FAILED/i.test(outcome);
  } catch (err) {
    ok = false;
    outcome = `FAILED - ${err instanceof Error ? err.message : "the desktop app couldn't type the login."}`;
  }
  await db.insert(actionReceiptsTable).values({
    description: ok ? `Signed in with your "${item.name}" login${skill ? ` for "${skill.name}"` : ""}` : `Sign-in with your "${item.name}" login didn't work`,
    category: "saved_login", scope: "local", outcome: ok ? "success" : "failure", target: item.name, canUndo: false,
  }).catch(() => undefined);
  if (!ok) return `${outcome.replace(/^FAILED -\s*/i, "FAILED - ")} The skill stopped here - check the "${item.name}" login in Settings > Credentials.`;
  return outcome.startsWith("DONE") ? outcome : `DONE - ${outcome}`;
}
