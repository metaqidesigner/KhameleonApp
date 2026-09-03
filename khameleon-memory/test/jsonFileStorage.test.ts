import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { JsonFileStorage } from "../src/storage/jsonFileStorage";
import { emptyMemoryData } from "../src/types";

let dir: string;
let filePath: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "khameleon-memory-"));
  filePath = path.join(dir, "nested", "memory.json"); // nested on purpose: proves mkdir -p works
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("JsonFileStorage", () => {
  it("load() on a file that doesn't exist yet returns empty data, not an error", async () => {
    const storage = new JsonFileStorage(filePath);
    expect(await storage.load()).toEqual(emptyMemoryData());
  });

  it("save() then load() round-trips real data through disk", async () => {
    const storage = new JsonFileStorage(filePath);
    const data = emptyMemoryData();
    data.facts["timezone"] = { key: "timezone", value: "EST", updatedAt: 123 };
    data.notes.push({ id: "n1", text: "hello", createdAt: 456 });

    await storage.save(data);
    const reloaded = await storage.load();
    expect(reloaded).toEqual(data);
  });

  it("a second, independent instance reading the same path sees the same data (real persistence)", async () => {
    const first = new JsonFileStorage(filePath);
    await first.save({ ...emptyMemoryData(), facts: { a: { key: "a", value: "1", updatedAt: 1 } } });

    const second = new JsonFileStorage(filePath);
    const reloaded = await second.load();
    expect(reloaded.facts.a.value).toBe("1");
  });

  it("save() never leaves a stray .tmp file behind", async () => {
    const storage = new JsonFileStorage(filePath);
    await storage.save(emptyMemoryData());
    const entries = await fs.readdir(path.dirname(filePath));
    expect(entries.some((e) => e.endsWith(".tmp"))).toBe(false);
    expect(entries).toContain("memory.json");
  });
});
