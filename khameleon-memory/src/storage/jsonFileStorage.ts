import * as fs from "fs/promises";
import * as path from "path";
import { MemoryData, MemoryStorage, emptyMemoryData } from "../types";

/**
 * Real persistence: one JSON file on disk. Writes are atomic — save()
 * writes to a temp file in the same directory, then renames it over the
 * real file. rename() is atomic on POSIX filesystems, so a crash or
 * power loss mid-write can never leave a half-written, corrupted memory
 * file behind; the reader always sees either the old complete version or
 * the new complete version, never a partial one.
 */
export class JsonFileStorage implements MemoryStorage {
  constructor(private filePath: string) {}

  async load(): Promise<MemoryData> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      return JSON.parse(raw) as MemoryData;
    } catch (err) {
      if (isNotFound(err)) return emptyMemoryData();
      throw err;
    }
  }

  async save(data: MemoryData): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmpPath, this.filePath);
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "ENOENT";
}
