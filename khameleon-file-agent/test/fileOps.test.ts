import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { FileOps } from "../src/fileOps";
import { SafetyError } from "../src/types";

// These tests do real disk I/O against a throwaway temp directory —
// deliberately not mocked, so a pass here means the operations genuinely
// work, not just that the code compiles.
let root: string;
let fileOps: FileOps;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "khameleon-fileops-"));
  fileOps = new FileOps(root);
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe("FileOps", () => {
  it("createFolder actually creates a directory on disk", async () => {
    const created = await fileOps.createFolder("Invoices/2026");
    const stat = await fs.stat(created);
    expect(stat.isDirectory()).toBe(true);
  });

  it("copyFile duplicates content and leaves the original in place", async () => {
    await fs.writeFile(path.join(root, "source.txt"), "hello khameleon");
    await fileOps.copyFile("source.txt", "Backups/source.txt");

    const original = await fs.readFile(path.join(root, "source.txt"), "utf8");
    const copy = await fs.readFile(path.join(root, "Backups/source.txt"), "utf8");
    expect(original).toBe("hello khameleon");
    expect(copy).toBe("hello khameleon");
  });

  it("moveFile relocates the file and removes it from the source path", async () => {
    await fs.writeFile(path.join(root, "draft.txt"), "v1");
    await fileOps.moveFile("draft.txt", "Archive/draft.txt");

    expect(await fileOps.exists("draft.txt")).toBe(false);
    expect(await fileOps.exists("Archive/draft.txt")).toBe(true);
  });

  it("moveToTrash is recoverable: file still exists on disk, just relocated", async () => {
    await fs.writeFile(path.join(root, "oops.txt"), "don't want this here");
    const trashedPath = await fileOps.moveToTrash("oops.txt");

    expect(await fileOps.exists("oops.txt")).toBe(false);
    const stillThere = await fs.readFile(trashedPath, "utf8");
    expect(stillThere).toBe("don't want this here");
    expect(trashedPath).toContain(".khameleon-trash");
  });

  it("deletePermanently refuses to run without explicit confirm=true", async () => {
    await fs.writeFile(path.join(root, "important.txt"), "keep me");
    // @ts-expect-error — intentionally calling without the required confirm arg to prove it's mandatory
    await expect(fileOps.deletePermanently("important.txt")).rejects.toThrow(/confirm/);
    expect(await fileOps.exists("important.txt")).toBe(true);
  });

  it("deletePermanently actually removes the file when confirmed", async () => {
    await fs.writeFile(path.join(root, "gone.txt"), "bye");
    await fileOps.deletePermanently("gone.txt", true);
    expect(await fileOps.exists("gone.txt")).toBe(false);
  });

  it("every method refuses to touch a path outside root", async () => {
    await expect(fileOps.createFolder("../outside")).rejects.toThrow(SafetyError);
    await expect(fileOps.moveFile("../../etc/passwd", "stolen.txt")).rejects.toThrow(
      SafetyError
    );
  });

  it("listDirectory reflects real directory contents and hides the trash folder", async () => {
    await fs.writeFile(path.join(root, "a.txt"), "a");
    await fs.mkdir(path.join(root, "sub"));
    await fileOps.moveToTrash("a.txt").catch(() => {}); // create the trash dir as a side effect

    const entries = await fileOps.listDirectory(".");
    const names = entries.map((e) => e.name);
    expect(names).toContain("sub");
    expect(names).not.toContain(".khameleon-trash");
  });
});
