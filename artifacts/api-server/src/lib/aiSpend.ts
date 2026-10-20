/**
 * Estimated spend on pay-per-use AIs, and an optional monthly limit (download
 * decisions, step 4 - 2026-10-20). Providers don't let apps read their bills,
 * so each answer is costed from the token counts the provider returns, at the
 * model's published prices - an estimate, in US dollars (what they bill in).
 * Khami (on this computer) and Microsoft 365 Copilot (a flat licence) cost
 * nothing per use and aren't counted. When the month's estimate reaches the
 * limit, pay-per-use AIs count as unavailable until next month, so Khameleon
 * falls back to Khami. Kept per month in the settings table.
 */
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";

/** Providers charged per use. */
export const PAY_PER_USE = new Set(["anthropic", "openai", "google", "openrouter", "minimax", "azure"]);

/** Published prices, US$ per million tokens [input, output] - checked 2026-10-20; update with each release. */
const PRICES: Record<string, [number, number]> = {
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-4-6": [3, 15],
  "claude-haiku-4-5": [1, 5],
  "gpt-5.4": [1.25, 10],
  "gpt-4o": [2.5, 10],
  "gpt-4o-mini": [0.15, 0.6],
  "gemini-2.0-flash": [0.1, 0.4],
  "gemini-1.5-pro": [1.25, 5],
};
/** Unknown models (including an organisation's own Azure deployment): a mid-range price, so the estimate errs on the high side. */
const FALLBACK: [number, number] = [3, 15];

export function pricesFor(model: string): [number, number] {
  const m = model.toLowerCase();
  return PRICES[m] ?? Object.entries(PRICES).find(([k]) => m.startsWith(k))?.[1] ?? FALLBACK;
}

/** US$ for one answer. Pure. */
export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const [i, o] = pricesFor(model);
  return (Math.max(0, inputTokens) * i + Math.max(0, outputTokens) * o) / 1_000_000;
}

export const monthKey = (d = new Date()) => `ai_spend:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const LIMIT_KEY = "ai_spend_limit_usd";

export interface ProviderSpend { usd: number; answers: number }
export type MonthSpend = Record<string, ProviderSpend>;

async function readSetting(key: string): Promise<string | null> {
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1).catch(() => [] as never[]);
  return row?.value ?? null;
}

async function writeSetting(key: string, value: string): Promise<void> {
  await db.insert(settingsTable).values({ key, value }).onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } });
}

export async function monthSpend(d = new Date()): Promise<MonthSpend> {
  try { return JSON.parse((await readSetting(monthKey(d))) ?? "{}") as MonthSpend; } catch { return {}; }
}

export const totalOf = (s: MonthSpend) => Object.values(s).reduce((sum, p) => sum + p.usd, 0);

/** Adds one answer to this month's estimate. Never throws - spend tracking mustn't break an answer. */
export async function recordSpend(provider: string, model: string, inputTokens: number, outputTokens: number): Promise<void> {
  if (!PAY_PER_USE.has(provider)) return;
  try {
    const s = await monthSpend();
    const p = s[provider] ?? { usd: 0, answers: 0 };
    s[provider] = { usd: p.usd + estimateCost(model, inputTokens, outputTokens), answers: p.answers + 1 };
    await writeSetting(monthKey(), JSON.stringify(s));
  } catch { /* the estimate is best-effort */ }
}

export async function spendLimit(): Promise<number | null> {
  const v = Number(await readSetting(LIMIT_KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** null removes the limit. */
export async function setSpendLimit(usd: number | null): Promise<void> {
  if (usd === null) await db.delete(settingsTable).where(eq(settingsTable.key, LIMIT_KEY));
  else await writeSetting(LIMIT_KEY, String(usd));
}

/** Has this month's estimate reached the limit? */
export async function overSpendLimit(): Promise<boolean> {
  const limit = await spendLimit();
  return limit !== null && totalOf(await monthSpend()) >= limit;
}

export function limitReachedMessage(limit: number): string {
  return `This month's limit for paid AIs (US$${limit.toFixed(2)}) has been reached, so Khameleon is using Khami instead. You can change the limit in Settings > AI.`;
}
