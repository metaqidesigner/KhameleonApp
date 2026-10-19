/**
 * Urgent email alerts (docs/build-review.md, Build 11): every 10 minutes,
 * flag only *urgent* mail from people the user actually writes to (or mail
 * marked important) in the suggestion slot - each flag says why. At most 3
 * a day by default, nothing in quiet hours (7pm-8am), several at once
 * grouped. Alternatives: only when asked, or off. Instant push alerts need
 * Khameleon reachable from the internet (hosted mode), so aren't offered yet.
 */
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { listUnread, classifyMessages, type Classified, type InboxMessage } from "./inboxTriage.js";
import { addSuggestion, countSince } from "./suggestions.js";
import { isConnected } from "./oauthTokens.js";
import * as outlook from "./outlookGraph.js";
import * as gmail from "./gmailApi.js";
import { logger } from "./logger.js";

export type AlertMode = "regular" | "on_request" | "off";
export interface AlertSettings { mode: AlertMode; maxPerDay: number; quietStart: number; quietEnd: number }
const KEY = "urgent_alerts";
const SEEN_KEY = "urgent_alerts_seen";
const DEFAULTS: AlertSettings = { mode: "regular", maxPerDay: 3, quietStart: 19, quietEnd: 8 };

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1).catch(() => [] as never[]);
  try { return row ? { ...fallback, ...JSON.parse(row.value) } : fallback; } catch { return fallback; }
}
async function writeJson(key: string, value: unknown): Promise<void> {
  const v = JSON.stringify(value);
  await db.insert(settingsTable).values({ key, value: v }).onConflictDoUpdate({ target: settingsTable.key, set: { value: v, updatedAt: new Date() } });
}

/** Keeps settings in range. Pure. */
export function cleanSettings(s: Partial<AlertSettings>): AlertSettings {
  const hour = (h: unknown, d: number) => (Number.isInteger(Number(h)) && Number(h) >= 0 && Number(h) <= 23 ? Number(h) : d);
  return {
    mode: s.mode === "on_request" || s.mode === "off" ? s.mode : "regular",
    maxPerDay: Math.min(10, Math.max(1, Number(s.maxPerDay) || DEFAULTS.maxPerDay)),
    quietStart: hour(s.quietStart, DEFAULTS.quietStart),
    quietEnd: hour(s.quietEnd, DEFAULTS.quietEnd),
  };
}
export const getAlertSettings = async () => cleanSettings(await readJson<Partial<AlertSettings>>(KEY, DEFAULTS));
export async function setAlertSettings(p: Partial<AlertSettings>): Promise<AlertSettings> {
  const next = cleanSettings({ ...(await getAlertSettings()), ...p });
  await writeJson(KEY, next);
  return next;
}

/** Quiet hours may wrap past midnight (e.g. 19-8). Pure. */
export function inQuietHours(now: Date, start: number, end: number): boolean {
  const h = now.getHours();
  if (start === end) return false;
  return start < end ? h >= start && h < end : h >= start || h < end;
}

/** Worth a closer look: from someone the user writes to, or marked important. Pure. */
export function isCandidate(m: InboxMessage, correspondents: Set<string>): boolean {
  return m.important || correspondents.has(m.from);
}

/** The flag shown in the suggestion slot - one for a single email, grouped for several. Pure. */
export function alertFor(urgent: Classified[], correspondents: Set<string>): { title: string; body: string; why: string } {
  const reason = (c: Classified) => `${correspondents.has(c.message.from) ? "someone you write to" : "marked important"} - ${c.why}`;
  if (urgent.length === 1) {
    const c = urgent[0];
    return { title: `Urgent: ${c.message.subject}`, why: `From ${c.message.fromName || c.message.from} (${reason(c)}).`, body: `${c.message.subject}\nFrom: ${c.message.fromName || c.message.from}\n\n${c.message.preview}` };
  }
  return {
    title: `${urgent.length} urgent emails`,
    why: `From ${urgent.slice(0, 3).map(c => c.message.fromName || c.message.from).join(", ")}${urgent.length > 3 ? " and others" : ""}.`,
    body: urgent.map(c => `- ${c.message.subject} - from ${c.message.fromName || c.message.from} (${reason(c)})\n  ${c.message.preview.slice(0, 160)}`).join("\n"),
  };
}

let correspondentCache: { at: number; set: Set<string> } | null = null;
async function correspondents(): Promise<Set<string>> {
  if (correspondentCache && Date.now() - correspondentCache.at < 3600_000) return correspondentCache.set;
  const out = new Set<string>();
  if (await isConnected("microsoft").catch(() => false)) for (const a of await outlook.recentRecipients(100).catch(() => [])) out.add(a);
  if (await isConnected("google").catch(() => false)) for (const a of await gmail.recentRecipients(60).catch(() => [])) out.add(a);
  correspondentCache = { at: Date.now(), set: out };
  return out;
}

/** One check: maybe adds one (possibly grouped) flag to the suggestion slot. */
export async function alertTick(now = new Date()): Promise<{ flagged: number; reason?: string }> {
  const s = await getAlertSettings();
  if (s.mode !== "regular") return { flagged: 0, reason: "alerts are not set to check regularly" };
  if (inQuietHours(now, s.quietStart, s.quietEnd)) return { flagged: 0, reason: "quiet hours" };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if ((await countSince("urgent_mail", today)) >= s.maxPerDay) return { flagged: 0, reason: "today's limit reached" };

  const seen = new Set((await readJson<{ ids: string[] }>(SEEN_KEY, { ids: [] })).ids);
  const people = await correspondents();
  const fresh = (await listUnread()).filter(m => !seen.has(m.id) && isCandidate(m, people));
  if (!fresh.length) return { flagged: 0 };
  const urgent = (await classifyMessages(fresh)).filter(c => c.classification === "urgent");
  await writeJson(SEEN_KEY, { ids: [...fresh.map(m => m.id), ...seen].slice(0, 300) });
  if (!urgent.length) return { flagged: 0 };
  const a = alertFor(urgent, people);
  await addSuggestion({ kind: "urgent_mail", ...a, ref: { ids: urgent.map(u => u.message.id) }, expiresAt: new Date(now.getTime() + 8 * 3600_000) });
  return { flagged: urgent.length };
}

let timer: NodeJS.Timeout | null = null;
export function startUrgentAlerts(): void {
  if (timer) return;
  const run = () => alertTick().catch(err => logger.warn({ err }, "Urgent email check failed"));
  timer = setInterval(run, 10 * 60_000);
  setTimeout(run, 60_000);
}
