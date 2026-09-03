import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { CommandRunner, parseCommand } from "../src/commands";
import { FileOps } from "../src/fileOps";
import { AppLauncher } from "../src/types";

class FakeAppLauncher implements AppLauncher {
  opened: string[] = [];
  quitCalls: string[] = [];
  private running = new Set<string>();

  async open(appName: string) {
    this.opened.push(appName);
    this.running.add(appName);
  }
  async quit(appName: string) {
    this.quitCalls.push(appName);
    this.running.delete(appName);
  }
  async isRunning(appName: string) {
    return this.running.has(appName);
  }
}

describe("parseCommand", () => {
  it('parses "create a folder called Invoices"', () => {
    expect(parseCommand("create a folder called Invoices")).toEqual({
      type: "create-folder",
      name: "Invoices",
    });
  });

  it('parses "move report.pdf to Archive/report.pdf"', () => {
    expect(parseCommand("move report.pdf to Archive/report.pdf")).toEqual({
      type: "move-file",
      from: "report.pdf",
      to: "Archive/report.pdf",
    });
  });

  it('parses "delete old-draft.txt" as a (recoverable) trash command', () => {
    expect(parseCommand("delete old-draft.txt")).toEqual({
      type: "trash-file",
      name: "old-draft.txt",
    });
  });

  it('parses "sort my Downloads"', () => {
    expect(parseCommand("sort my Downloads")).toEqual({
      type: "sort-folder",
      folder: "Downloads",
    });
  });

  it('parses "open Slack" / "quit Slack"', () => {
    expect(parseCommand("open Slack")).toEqual({ type: "open-app", appName: "Slack" });
    expect(parseCommand("quit Slack")).toEqual({ type: "quit-app", appName: "Slack" });
  });

  it("never produces a permanent-delete command from parsed text", () => {
    const cmd = parseCommand("permanently delete old-draft.txt");
    // Falls through to trash-file (matches on "delete ..."), never a bypass to deletePermanently.
    expect(cmd?.type).not.toBe("delete-permanently");
  });
});

describe("CommandRunner — real file I/O + fake app launcher", () => {
  let root: string;
  let runner: CommandRunner;
  let launcher: FakeAppLauncher;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), "khameleon-commands-"));
    launcher = new FakeAppLauncher();
    runner = new CommandRunner(new FileOps(root), launcher);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it("creates a real folder on disk", async () => {
    const result = await runner.run("create a folder called Invoices");
    expect(result).toBe('Created folder "Invoices".');
    const stat = await fs.stat(path.join(root, "Invoices"));
    expect(stat.isDirectory()).toBe(true);
  });

  it("sorts a messy folder using the default drop-zone rules", async () => {
    await fs.mkdir(path.join(root, "Downloads"));
    await fs.writeFile(path.join(root, "Downloads/photo.png"), "x");
    await fs.writeFile(path.join(root, "Downloads/report.pdf"), "x");
    await fs.writeFile(path.join(root, "Downloads/notes"), "x"); // unmatched, stays put

    const result = await runner.run("sort my Downloads");
    expect(result).toBe('Sorted 2 of 3 file(s) in "Downloads".');

    const imagesExists = await fs
      .stat(path.join(root, "Downloads/Images/photo.png"))
      .then(() => true)
      .catch(() => false);
    const docsExists = await fs
      .stat(path.join(root, "Downloads/Documents/report.pdf"))
      .then(() => true)
      .catch(() => false);
    const notesStillThere = await fs
      .stat(path.join(root, "Downloads/notes"))
      .then(() => true)
      .catch(() => false);

    expect(imagesExists).toBe(true);
    expect(docsExists).toBe(true);
    expect(notesStillThere).toBe(true);
  });

  it("routes open/quit app commands to the launcher, not the filesystem", async () => {
    expect(await runner.run("open Slack")).toBe("Opened Slack.");
    expect(launcher.opened).toEqual(["Slack"]);
    expect(await launcher.isRunning("Slack")).toBe(true);

    expect(await runner.run("quit Slack")).toBe("Quit Slack.");
    expect(launcher.quitCalls).toEqual(["Slack"]);
    expect(await launcher.isRunning("Slack")).toBe(false);
  });
});
