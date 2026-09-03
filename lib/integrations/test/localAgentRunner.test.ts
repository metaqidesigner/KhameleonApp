import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { LocalAgentRunner, type AnthropicMessagesClient } from "../src/localAgentRunner";
import type { Runners } from "../src/coordinator";

type Message = Anthropic.Messages.Message;
type CreateParams = Anthropic.Messages.MessageCreateParamsNonStreaming;

function textBlock(text: string) {
  return { type: "text" as const, text };
}

function toolUseBlock(id: string, name: string, input: Record<string, unknown>) {
  return { type: "tool_use" as const, id, name, input };
}

/** Fake Anthropic client that replays a scripted sequence of responses, one per call. */
function scriptedClient(responses: Partial<Message>[]): AnthropicMessagesClient & { calls: CreateParams[] } {
  const calls: CreateParams[] = [];
  let i = 0;
  return {
    calls,
    messages: {
      create: async (params: CreateParams) => {
        calls.push(params);
        const next = responses[Math.min(i, responses.length - 1)];
        i++;
        return next as Message;
      },
    },
  };
}

function fakeRunners(): Runners & { calls: string[] } {
  const calls: string[] = [];
  const runner = (label: string) => ({
    run: async (text: string) => {
      calls.push(`${label}:${text}`);
      return `${label} ok: ${text}`;
    },
  });
  return {
    calls,
    window: runner("window") as unknown as Runners["window"],
    file: runner("file") as unknown as Runners["file"],
    memory: runner("memory") as unknown as Runners["memory"],
  };
}

describe("LocalAgentRunner", () => {
  it("rejects an empty command without calling the model", async () => {
    const client = scriptedClient([]);
    const runner = new LocalAgentRunner(fakeRunners(), client, "test-model");
    await expect(runner.run("   ")).rejects.toThrow(/non-empty/);
    expect(client.calls.length).toBe(0);
  });

  it("executes multiple tool calls across turns before replying", async () => {
    const runners = fakeRunners();
    const client = scriptedClient([
      {
        stop_reason: "tool_use",
        content: [
          toolUseBlock("t1", "window_command", { command: "open youtube https://x as Focus Music" }),
        ],
      },
      {
        stop_reason: "tool_use",
        content: [toolUseBlock("t2", "window_command", { command: "move it to the corner" })],
      },
      {
        stop_reason: "end_turn",
        content: [textBlock("Opened the video and moved it to the corner.")],
      },
    ]);

    const runner = new LocalAgentRunner(runners, client, "test-model");
    const result = await runner.run("open youtube enlarged, then move it aside");

    expect(result.reply).toBe("Opened the video and moved it to the corner.");
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0]).toMatchObject({ name: "window_command", result: "window ok: open youtube https://x as Focus Music" });
    expect(result.toolCalls[1]).toMatchObject({ name: "window_command", result: "window ok: move it to the corner" });
    expect(runners.calls).toEqual([
      "window:open youtube https://x as Focus Music",
      "window:move it to the corner",
    ]);

    // Three model calls: two tool-use turns + one final end_turn reply.
    expect(client.calls).toHaveLength(3);
    // The second call's message history includes the first assistant tool_use
    // turn and the matching tool_result turn.
    const secondCallMessages = client.calls[1].messages;
    expect(secondCallMessages[1]).toMatchObject({ role: "assistant" });
    expect(secondCallMessages[2]).toMatchObject({ role: "user" });
  });

  it("turns a dispatch error into a tool_result error block and keeps going", async () => {
    const runners = fakeRunners();
    const client = scriptedClient([
      {
        stop_reason: "tool_use",
        content: [toolUseBlock("t1", "window_command", {})], // missing `command` -> dispatch throws
      },
      {
        stop_reason: "end_turn",
        content: [textBlock("Couldn't complete that — the instruction was unclear.")],
      },
    ]);

    const runner = new LocalAgentRunner(runners, client, "test-model");
    const result = await runner.run("do something vague");

    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].error).toMatch(/non-empty/);
    expect(result.reply).toBe("Couldn't complete that — the instruction was unclear.");

    const secondCallMessages = client.calls[1].messages;
    const toolResultTurn = secondCallMessages[2] as { role: string; content: Array<{ is_error?: boolean }> };
    expect(toolResultTurn.content[0].is_error).toBe(true);
  });

  it("stops after maxIterations and returns a fallback reply if the model never finishes", async () => {
    const runners = fakeRunners();
    const client = scriptedClient([
      {
        stop_reason: "tool_use",
        content: [toolUseBlock("t1", "memory_command", { command: "remember X is Y" })],
      },
    ]); // same tool_use response every time — model never reaches end_turn
    const runner = new LocalAgentRunner(runners, client, "test-model", 3);

    const result = await runner.run("loop forever");

    expect(result.reply).toMatch(/maximum number of actions/);
    expect(result.toolCalls).toHaveLength(3);
    expect(client.calls).toHaveLength(3);
  });
});
