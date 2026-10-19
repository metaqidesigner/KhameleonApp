import { test } from "node:test";
import assert from "node:assert/strict";
import { runOpenAiToolLoop, type ChatClient } from "./openAiToolLoop.js";

test("GPT-style tool calling: runs the tool, sends the result back, returns the final answer", async () => {
  const seen: Record<string, unknown>[] = [];
  const client: ChatClient = { chat: { completions: { create: async (p) => {
    seen.push(p);
    if (seen.length === 1) return { choices: [{ message: { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "create_task", arguments: '{"title":"Chase invoice 10260"}' } }] } }], usage: { total_tokens: 10 } };
    return { choices: [{ message: { content: "Added the task." } }], usage: { total_tokens: 5 } };
  } } } };
  const ran: unknown[] = [];
  const events: string[] = [];
  const r = await runOpenAiToolLoop(client, "gpt-4o", [{ role: "system", content: "s" }, { role: "user", content: "add a task" }],
    [{ name: "create_task", description: "Create a task", parameters: { type: "object", properties: { title: { type: "string" } } }, run: async (i) => { ran.push(i); return "Task 7 created"; } }],
    (e) => events.push(e.type));
  assert.equal(r.content, "Added the task.");
  assert.equal(r.toolCalls, 1);
  assert.equal(r.tokens, 15);
  assert.deepEqual(ran, [{ title: "Chase invoice 10260" }]);
  assert.deepEqual(events, ["tool_start", "tool_result"]);
  const second = seen[1].messages as { role: string; content: string }[];
  assert.equal(second[0].role, "system", "the instructions are sent");
  assert.equal(second.at(-1)!.role, "tool");
  assert.equal(second.at(-1)!.content, "Task 7 created");
  assert.equal((seen[0].tools as unknown[]).length, 1);
});

test("an unknown tool is reported back to the AI, not crashed on", async () => {
  let n = 0;
  const client: ChatClient = { chat: { completions: { create: async () => (++n === 1
    ? { choices: [{ message: { content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "delete_everything", arguments: "{}" } }] } }] }
    : { choices: [{ message: { content: "I can't do that." } }] }) } } };
  const events: string[] = [];
  const r = await runOpenAiToolLoop(client, "m", [{ role: "user", content: "x" }], [], (e) => events.push(e.type));
  assert.equal(r.content, "I can't do that.");
  assert.deepEqual(events, ["tool_start", "tool_error"]);
});
