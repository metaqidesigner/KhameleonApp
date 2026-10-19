/**
 * Tools for GPT, Gemini and Azure OpenAI (docs/khami-design.md, step 5):
 * the same safe tool catalogue Khami and the chat use (agents/tools/
 * anyAiTools.ts), through the OpenAI-style function-calling interface those
 * engines share. The client is passed in, so the loop can be tested with a
 * stand-in.
 */
import type { AnyAiTool } from "./tools/anyAiTools.js";
import type { ToolEvent } from "./types.js";

type Msg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
interface ToolCall { id: string; type: "function"; function: { name: string; arguments: string } }

export interface ChatClient {
  chat: { completions: { create(params: Record<string, unknown>): Promise<{ choices: { message: { content: string | null; tool_calls?: ToolCall[] } }[]; usage?: { total_tokens?: number } }> } };
}

export const MAX_TOOL_ROUNDS = 6;

export async function runOpenAiToolLoop(
  client: ChatClient,
  model: string,
  messages: Msg[],
  tools: AnyAiTool[],
  onToolEvent?: (e: ToolEvent) => void,
): Promise<{ content: string; tokens: number; toolCalls: number }> {
  const defs = tools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const msgs: Msg[] = [...messages];
  let tokens = 0;
  let toolCalls = 0;
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await client.chat.completions.create({ model, messages: msgs, tools: defs, max_completion_tokens: 4096 });
    tokens += res.usage?.total_tokens ?? 0;
    const reply = res.choices[0]?.message;
    if (!reply?.tool_calls?.length) return { content: reply?.content ?? "", tokens, toolCalls };
    msgs.push({ role: "assistant", content: reply.content ?? null, tool_calls: reply.tool_calls });
    for (const call of reply.tool_calls) {
      const tool = tools.find(t => t.name === call.function.name);
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(call.function.arguments || "{}"); } catch { /* bad arguments - the tool reports it */ }
      const t0 = Date.now();
      onToolEvent?.({ type: "tool_start", name: call.function.name, input });
      let result: string;
      try {
        if (!tool) throw new Error(`There's no tool called ${call.function.name}.`);
        result = await tool.run(input);
        onToolEvent?.({ type: "tool_result", name: call.function.name, result: result.slice(0, 500), durationMs: Date.now() - t0 });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        result = `Error: ${error}`;
        onToolEvent?.({ type: "tool_error", name: call.function.name, error, durationMs: Date.now() - t0 });
      }
      toolCalls++;
      msgs.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  return { content: "I took the maximum number of steps without finishing - try a smaller request.", tokens, toolCalls };
}
