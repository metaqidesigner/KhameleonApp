import { rank } from "./search";
import {
  Fact,
  MemoryStorage,
  Note,
  Routine,
  SearchResult,
} from "./types";

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

/**
 * The single entry point the rest of Khameleon talks to for anything it
 * needs to remember. Every mutating method persists immediately via the
 * injected MemoryStorage — callers never need to remember to "save."
 */
export class MemoryStore {
  constructor(private storage: MemoryStorage) {}

  // ---- Facts (key/value preferences) ----------------------------------

  async remember(key: string, value: string): Promise<void> {
    const data = await this.storage.load();
    data.facts[normalizeKey(key)] = { key, value, updatedAt: Date.now() };
    await this.storage.save(data);
  }

  async recall(key: string): Promise<Fact | null> {
    const data = await this.storage.load();
    return data.facts[normalizeKey(key)] ?? null;
  }

  async forget(key: string): Promise<void> {
    const data = await this.storage.load();
    delete data.facts[normalizeKey(key)];
    await this.storage.save(data);
  }

  async allFacts(): Promise<Fact[]> {
    const data = await this.storage.load();
    return Object.values(data.facts);
  }

  // ---- Notes (freeform, searchable) ------------------------------------

  async saveNote(text: string): Promise<Note> {
    const data = await this.storage.load();
    const note: Note = { id: nextId("note"), text, createdAt: Date.now() };
    data.notes.push(note);
    await this.storage.save(data);
    return note;
  }

  async searchNotes(query: string): Promise<SearchResult<Note>[]> {
    const data = await this.storage.load();
    return rank(data.notes, query, (n) => n.text);
  }

  // ---- Routines (learned/demonstrated workflows) ------------------------

  async recordRoutine(label: string, triggers: string[], steps: unknown[]): Promise<Routine> {
    const data = await this.storage.load();
    const routine: Routine = {
      id: nextId("routine"),
      label,
      triggers,
      steps,
      createdAt: Date.now(),
      lastUsedAt: null,
      useCount: 0,
    };
    data.routines.push(routine);
    await this.storage.save(data);
    return routine;
  }

  /** Finds the best-matching routine for a spoken/typed request, e.g.
   * "sort my downloads" matching a routine whose triggers include that phrase. */
  async findRoutine(query: string): Promise<Routine | null> {
    const data = await this.storage.load();
    const results = rank(data.routines, query, (r) => [r.label, ...r.triggers].join(" "));
    return results[0]?.item ?? null;
  }

  async listRoutines(): Promise<Routine[]> {
    const data = await this.storage.load();
    return data.routines;
  }

  /** Call after successfully replaying a routine, so usage stats reflect reality. */
  async markRoutineUsed(id: string): Promise<void> {
    const data = await this.storage.load();
    const routine = data.routines.find((r) => r.id === id);
    if (!routine) return;
    routine.useCount += 1;
    routine.lastUsedAt = Date.now();
    await this.storage.save(data);
  }
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}
