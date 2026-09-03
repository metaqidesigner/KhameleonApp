import { SearchResult } from "./types";

const STOPWORDS = new Set(["a", "an", "the", "is", "my", "to", "of", "for", "in", "on", "at"]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
}

/**
 * Scores `text` against `query` by token overlap: how many distinct query
 * tokens appear in the text, plus a small bonus for exact substring
 * matches (catches multi-word phrases the token-overlap score alone
 * would under-rank). Deliberately simple — no external search engine,
 * no native dependency, good enough for a personal memory store's scale.
 */
export function scoreMatch(query: string, text: string): number {
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return 0;

  const textTokens = new Set(tokenize(text));
  let overlap = 0;
  for (const t of queryTokens) if (textTokens.has(t)) overlap++;

  let score = overlap / queryTokens.size;
  if (text.toLowerCase().includes(query.toLowerCase().trim())) {
    score += 0.5;
  }
  return score;
}

/**
 * Ranks `items` against `query` using `getText` to extract the searchable
 * string from each, dropping anything that scores 0, highest score first.
 */
export function rank<T>(
  items: T[],
  query: string,
  getText: (item: T) => string
): SearchResult<T>[] {
  return items
    .map((item) => ({ item, score: scoreMatch(query, getText(item)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
