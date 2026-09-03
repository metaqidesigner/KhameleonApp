import { describe, expect, it } from "vitest";
import { CommandRunner, parseCommand } from "../src/commands";
import { MemoryStore } from "../src/memoryStore";
import { InMemoryStorage } from "../src/storage/inMemoryStorage";

describe("parseCommand", () => {
  it('parses "remember my timezone is EST", stripping "my" so the key matches how recall parses it', () => {
    expect(parseCommand("remember my timezone is EST")).toEqual({
      type: "remember",
      key: "timezone",
      value: "EST",
    });
  });

  it('parses "what\'s my timezone"', () => {
    expect(parseCommand("what's my timezone")).toEqual({ type: "recall", key: "timezone" });
  });

  it('parses "note: meeting moved to 3pm"', () => {
    expect(parseCommand("note: meeting moved to 3pm")).toEqual({
      type: "save-note",
      text: "meeting moved to 3pm",
    });
  });

  it('parses "find notes about the meeting"', () => {
    expect(parseCommand("find notes about the meeting")).toEqual({
      type: "search-notes",
      query: "the meeting",
    });
  });

  it("returns null for unrelated input", () => {
    expect(parseCommand("open Slack")).toBeNull();
  });
});

describe("CommandRunner", () => {
  it("remember -> recall round-trips through natural language (this is the case that caught the key-mismatch bug)", async () => {
    const runner = new CommandRunner(new MemoryStore(new InMemoryStorage()));
    expect(await runner.run("remember my timezone is EST")).toBe("Got it — timezone is EST.");
    expect(await runner.run("what's my timezone")).toBe("Your timezone is EST.");
  });

  it("recalling something never taught says so honestly", async () => {
    const runner = new CommandRunner(new MemoryStore(new InMemoryStorage()));
    expect(await runner.run("what's my favorite color")).toBe(
      "I don't know your favorite color yet."
    );
  });

  it("note + search-notes works end to end", async () => {
    const runner = new CommandRunner(new MemoryStore(new InMemoryStorage()));
    await runner.run("note: meeting moved to 3pm");
    await runner.run("note: buy milk");
    expect(await runner.run("find notes about meeting")).toBe("- meeting moved to 3pm");
  });
});
