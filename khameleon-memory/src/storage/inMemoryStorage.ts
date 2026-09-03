import { MemoryData, MemoryStorage, emptyMemoryData } from "../types";

/** Ephemeral, process-lifetime-only storage. Used by tests and by any
 * caller that explicitly doesn't want persistence. */
export class InMemoryStorage implements MemoryStorage {
  private data: MemoryData = emptyMemoryData();

  async load(): Promise<MemoryData> {
    // Return a deep-ish copy so callers can't mutate our internal state
    // by mutating what load() returned.
    return JSON.parse(JSON.stringify(this.data));
  }

  async save(data: MemoryData): Promise<void> {
    this.data = JSON.parse(JSON.stringify(data));
  }
}
