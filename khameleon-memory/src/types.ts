/** A remembered key/value fact — "I prefer dark mode", "my timezone is EST". */
export interface Fact {
  key: string;
  value: string;
  updatedAt: number;
}

/** A freeform note, e.g. "meeting moved to 3pm". Searchable by content. */
export interface Note {
  id: string;
  text: string;
  createdAt: number;
}

/**
 * A learned routine — the record of a demonstrated workflow, per the
 * Phase 3 "show it how it's done" concept in the Khameleon scope doc.
 * `steps` is intentionally opaque JSON: this module doesn't know about
 * window-agent's Command type or file-agent's Command type, it just
 * stores and retrieves whatever sequence a calling module hands it, so
 * neither of those modules becomes a dependency of this one.
 */
export interface Routine {
  id: string;
  label: string;
  /** Phrases that should trigger replaying this routine, e.g. "sort my downloads". */
  triggers: string[];
  steps: unknown[];
  createdAt: number;
  lastUsedAt: number | null;
  useCount: number;
}

export interface SearchResult<T> {
  item: T;
  score: number;
}

/**
 * Everything the memory store needs from its persistence layer. Kept
 * tiny and swappable — InMemoryStorage for tests, JsonFileStorage for
 * the real app — so MemoryStore itself never touches disk directly.
 */
export interface MemoryStorage {
  load(): Promise<MemoryData>;
  save(data: MemoryData): Promise<void>;
}

export interface MemoryData {
  facts: Record<string, Fact>;
  notes: Note[];
  routines: Routine[];
}

export function emptyMemoryData(): MemoryData {
  return { facts: {}, notes: [], routines: [] };
}
