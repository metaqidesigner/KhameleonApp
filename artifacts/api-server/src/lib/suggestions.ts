/**
 * The suggestion slot (gap review Q17; Builds 10-11): a small card at the
 * top of the screen for the few things worth an interruption - a meeting
 * brief before a meeting, genuinely urgent mail. Kept rare by the features
 * that add to it (lead time, daily limits, quiet hours).
 */
import { and, desc, eq, gte, isNull, or, gt, sql } from "drizzle-orm";
import { db, suggestionsTable, type Suggestion } from "@workspace/db";

export async function addSuggestion(s: { kind: string; title: string; body?: string; why?: string; ref?: Record<string, unknown>; expiresAt?: Date }): Promise<Suggestion> {
  const [row] = await db.insert(suggestionsTable).values({ kind: s.kind, title: s.title, body: s.body ?? "", why: s.why ?? "", ref: s.ref ?? {}, expiresAt: s.expiresAt ?? null }).returning();
  return row;
}

export async function activeSuggestions(now = new Date()): Promise<Suggestion[]> {
  return db.select().from(suggestionsTable)
    .where(and(isNull(suggestionsTable.dismissedAt), or(isNull(suggestionsTable.expiresAt), gt(suggestionsTable.expiresAt, now)), gte(suggestionsTable.createdAt, new Date(now.getTime() - 24 * 3600_000))))
    .orderBy(desc(suggestionsTable.createdAt)).limit(10);
}

export async function dismissSuggestion(id: number): Promise<void> {
  await db.update(suggestionsTable).set({ dismissedAt: new Date() }).where(eq(suggestionsTable.id, id));
}

export async function markOpened(id: number): Promise<void> {
  await db.update(suggestionsTable).set({ openedAt: new Date(), dismissedAt: new Date() }).where(eq(suggestionsTable.id, id));
}

/** How many of a kind were shown since a time (for daily limits). */
export async function countSince(kind: string, since: Date): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(suggestionsTable).where(and(eq(suggestionsTable.kind, kind), gte(suggestionsTable.createdAt, since)));
  return r?.n ?? 0;
}
