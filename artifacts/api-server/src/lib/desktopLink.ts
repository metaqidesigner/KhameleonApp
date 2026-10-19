/**
 * The link between this server and the Khameleon desktop app (Build 7).
 * The chat's AI (Khami first) runs here, but working in other apps, files
 * and typing saved logins can only happen on the user's computer - so the
 * desktop app asks this server for work (long-polling) and posts results
 * back. Pairing: the desktop app hands its secret code to its own signed-in
 * Khameleon window, which registers it here (POST /api/desktop/pair, behind
 * the normal sign-in) - only the code's hash is stored. The desktop app's
 * requests must carry that code; anything else is refused.
 */
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

const PIN_KEY = "desktop_link_pin";
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export interface DesktopRequest { id: string; action: string; input: Record<string, unknown> }
interface Pending { req: DesktopRequest; resolve: (r: string) => void; reject: (e: Error) => void; timer: NodeJS.Timeout; sent: boolean }

const queue: Pending[] = [];
const waiting: ((r: DesktopRequest | null) => void)[] = [];
let lastSeen = 0;

/** Registers the desktop app's code (called by a signed-in Khameleon window). */
export async function pairDesktop(code: string): Promise<void> {
  const value = sha(code);
  await db.insert(settingsTable).values({ key: PIN_KEY, value }).onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

/** Is this caller the paired desktop app? */
export async function checkDesktopCode(code: string | undefined): Promise<boolean> {
  if (!code || code.length < 32) return false;
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, PIN_KEY)).limit(1);
  if (!row) return false;
  return crypto.timingSafeEqual(Buffer.from(row.value), Buffer.from(sha(code)));
}

/** Forget the paired desktop app (e.g. a new computer). */
export async function unpairDesktop(): Promise<void> {
  await db.delete(settingsTable).where(eq(settingsTable.key, PIN_KEY));
}

export function desktopOnline(): boolean {
  return Date.now() - lastSeen < 45_000;
}

/** The desktop app waits here for its next job (up to `waitMs`). */
export function nextRequest(waitMs: number): Promise<DesktopRequest | null> {
  lastSeen = Date.now();
  const p = queue.find(q => !q.sent);
  if (p) { p.sent = true; return Promise.resolve(p.req); }
  return new Promise(resolve => {
    const done = (r: DesktopRequest | null) => { clearTimeout(t); resolve(r); };
    const t = setTimeout(() => { const i = waiting.indexOf(done); if (i >= 0) waiting.splice(i, 1); lastSeen = Date.now(); resolve(null); }, waitMs);
    waiting.push(done);
  });
}

export function finishRequest(id: string, ok: boolean, result: string): boolean {
  const i = queue.findIndex(q => q.req.id === id);
  if (i < 0) return false;
  const [p] = queue.splice(i, 1);
  clearTimeout(p.timer);
  if (ok) p.resolve(result); else p.reject(new Error(result || "The desktop app couldn't do that."));
  return true;
}

export class DesktopOfflineError extends Error {
  constructor() { super("The Khameleon desktop app isn't running, so Khameleon can't work in your other apps right now."); }
}

/** Asks the desktop app to do something and waits for the result. */
export function callDesktop(action: string, input: Record<string, unknown>, timeoutMs = 120_000): Promise<string> {
  if (!desktopOnline()) return Promise.reject(new DesktopOfflineError());
  return new Promise((resolve, reject) => {
    const req: DesktopRequest = { id: crypto.randomUUID(), action, input };
    const timer = setTimeout(() => {
      const i = queue.findIndex(q => q.req.id === req.id);
      if (i >= 0) queue.splice(i, 1);
      reject(new Error("The desktop app didn't answer in time."));
    }, timeoutMs);
    const pending: Pending = { req, resolve, reject, timer, sent: false };
    queue.push(pending);
    const w = waiting.shift();
    if (w) { pending.sent = true; w(req); }
  });
}
