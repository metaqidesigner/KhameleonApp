import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { MemoryStore } from "../src/memoryStore";
import { InMemoryStorage } from "../src/storage/inMemoryStorage";
import { JsonFileStorage } from "../src/storage/jsonFileStorage";

describe("MemoryStore — facts", () => {
  it("remember/recall round-trips a value", async () => {
    const store = new MemoryStore(new InMemoryStorage());
    await store.remember("timezone", "EST");
    expect(await store.recall("timezone")).toMatchObject({ key: "timezone", value: "EST" });
  });

  it("recall on an unknown key returns null, not an error", async () => {
    const store = new MemoryStore(new InMemoryStorage());
    expect(await store.recall("nonexistent")).toBeNull();
  });

  it("remembering the same key again overwrites the old value", async () => {
    const store = new MemoryStore(new InMemoryStorage());
    await store.remember("theme", "light");
    await store.remember("theme", "dark");
    expect((await store.recall("theme"))?.value).toBe("dark");
  });

  it("key lookup is case/whitespace insensitive", async () => {
    const store = new MemoryStore(new InMemoryStorage());
    await store.remember("  Timezone  ", "EST");
    expect((await store.recall("timezone"))?.value).toBe("EST");
  });

  it("forget removes a fact", async () => {
    const store = new MemoryStore(new InMemoryStorage());
    await store.remember("timezone", "EST");
    await store.forget("timezone");
    expect(await store.recall("timezone")).toBeNull();
  });
});

describe("MemoryStore — notes", () => {
  it("saveNote persists it and searchNotes finds it by relevance", async () => {
    const store = new MemoryStore(new InMemoryStorage());
    await store.saveNote("meeting moved to 3pm");
    await store.saveNote("buy milk");

    const results = await store.searchNotes("meeting time");
    expect(results[0].item.text).toBe("meeting moved to 3pm");
  });

  it("returns no results for a query that matches nothing", async () => {
    const store = new MemoryStore(new InMemoryStorage());
    await store.saveNote("buy milk");
    expect(await store.searchNotes("quarterly earnings")).toEqual([]);
  });
});

describe("MemoryStore — routines (learn-by-demonstration substrate)", () => {
  it("records a routine and finds it again by a natural-language trigger", async () => {
    const store = new MemoryStore(new InMemoryStorage());
    await store.recordRoutine(
      "Sort Downloads",
      ["sort my downloads", "clean up downloads"],
      [{ type: "sort-folder", folder: "Downloads" }] // opaque to this module on purpose
    );

    const found = await store.findRoutine("please sort my downloads folder");
    expect(found?.label).toBe("Sort Downloads");
    expect(found?.steps).toEqual([{ type: "sort-folder", folder: "Downloads" }]);
  });

  it("markRoutineUsed increments useCount and sets lastUsedAt", async () => {
    const store = new MemoryStore(new InMemoryStorage());
    const routine = await store.recordRoutine("Test", ["run test"], []);
    expect(routine.useCount).toBe(0);
    expect(routine.lastUsedAt).toBeNull();

    await store.markRoutineUsed(routine.id);
    const [updated] = await store.listRoutines();
    expect(updated.useCount).toBe(1);
    expect(updated.lastUsedAt).not.toBeNull();
  });

  it("findRoutine returns null when nothing matches", async () => {
    const store = new MemoryStore(new InMemoryStorage());
    await store.recordRoutine("Sort Downloads", ["sort my downloads"], []);
    expect(await store.findRoutine("send an invoice to the client")).toBeNull();
  });
});

describe("MemoryStore — real persistence end-to-end", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "khameleon-memorystore-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("a fact remembered by one MemoryStore instance is recalled by a brand new one reading the same file", async () => {
    const filePath = path.join(dir, "memory.json");

    const first = new MemoryStore(new JsonFileStorage(filePath));
    await first.remember("favorite editor", "vscode");
    await first.saveNote("prefers dark mode everywhere");

    // Simulates an app restart: a fresh MemoryStore, fresh storage instance,
    // same file on disk.
    const second = new MemoryStore(new JsonFileStorage(filePath));
    expect((await second.recall("favorite editor"))?.value).toBe("vscode");
    const notes = await second.searchNotes("dark mode");
    expect(notes[0].item.text).toBe("prefers dark mode everywhere");
  });
});
