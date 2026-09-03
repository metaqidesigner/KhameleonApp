import { describe, expect, it } from "vitest";
import { dispatchLocalTool, LOCAL_TOOL_DEFINITIONS } from "../src/tools";
import type { Runners } from "../src/coordinator";

function fakeRunners(overrides: Partial<Runners> = {}): Runners {
  return {
    window: { run: async (text: string) => `window ran: ${text}` } as unknown as Runners["window"],
    file: { run: async (text: string) => `file ran: ${text}` } as unknown as Runners["file"],
    memory: { run: async (text: string) => `memory ran: ${text}` } as unknown as Runners["memory"],
    ...overrides,
  };
}

describe("LOCAL_TOOL_DEFINITIONS", () => {
  it("declares exactly the three action tools, each requiring a command string", () => {
    const names = LOCAL_TOOL_DEFINITIONS.map((t) => t.name);
    expect(names).toEqual(["window_command", "file_command", "memory_command"]);
    for (const tool of LOCAL_TOOL_DEFINITIONS) {
      expect(tool.input_schema.required).toEqual(["command"]);
    }
  });
});

describe("dispatchLocalTool", () => {
  it("routes window_command to the window runner", async () => {
    const runners = fakeRunners();
    const result = await dispatchLocalTool("window_command", { command: "open youtube" }, runners);
    expect(result).toBe("window ran: open youtube");
  });

  it("routes file_command to the file runner", async () => {
    const runners = fakeRunners();
    const result = await dispatchLocalTool("file_command", { command: "create folder Invoices" }, runners);
    expect(result).toBe("file ran: create folder Invoices");
  });

  it("routes memory_command to the memory runner", async () => {
    const runners = fakeRunners();
    const result = await dispatchLocalTool("memory_command", { command: "remember my timezone is EST" }, runners);
    expect(result).toBe("memory ran: remember my timezone is EST");
  });

  it("trims whitespace from the command before dispatching", async () => {
    const runners = fakeRunners();
    const result = await dispatchLocalTool("window_command", { command: "  close it  " }, runners);
    expect(result).toBe("window ran: close it");
  });

  it("throws on an unknown tool name", async () => {
    const runners = fakeRunners();
    await expect(dispatchLocalTool("delete_everything", { command: "x" }, runners)).rejects.toThrow(
      /Unknown tool/,
    );
  });

  it("throws when the command is missing", async () => {
    const runners = fakeRunners();
    await expect(dispatchLocalTool("window_command", {}, runners)).rejects.toThrow(/non-empty/);
  });

  it("throws when the command is an empty/whitespace-only string", async () => {
    const runners = fakeRunners();
    await expect(dispatchLocalTool("file_command", { command: "   " }, runners)).rejects.toThrow(/non-empty/);
  });
});
