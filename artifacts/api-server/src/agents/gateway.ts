import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AgentConfig, AgentResponse, ChatMessage, Provider, ToolCallRecord, ToolEvent } from "./types.js";
import { TOOL_DEFINITIONS } from "./tools/definitions.js";
import { dispatchTool } from "./tools/dispatcher.js";
import { getApiKey } from "../lib/apiKeys.js";

// ── Cost tables (USD per 1k tokens) ──────────────────────────
const COST_TABLE: Record<string, number> = {
  "claude-sonnet-4-6": 0.009,
  "claude-opus-4-8":   0.045,
  "claude-haiku-4-5":  0.0005,
  "gpt-4o":            0.0075,
  "gpt-5.4":           0.010,
  "gpt-4o-mini":       0.0003,
  "gemini-2.0-flash":  0.00010,
  "gemini-1.5-pro":    0.00175,
};
const ENERGY_PER_1K = 0.001;

export function costForTokens(model: string, tokens: number): number {
  return (tokens / 1000) * (COST_TABLE[model] ?? 0.002);
}
function energyForTokens(tokens: number): number {
  return (tokens / 1000) * ENERGY_PER_1K;
}

// ── Provider URLs ─────────────────────────────────────────────
const PROVIDER_URLS: Partial<Record<Provider, string>> = {
  google:     "https://generativelanguage.googleapis.com/v1beta/openai/",
  openrouter: "https://openrouter.ai/api/v1",
  ollama:     "http://localhost:11434/v1",
  minimax:    "https://api.minimax.chat/v1",
};

/**
 * Resolves an API key in priority order:
 *   1. An explicit per-agent override (agent.apiKey, set via the roster UI)
 *   2. A key the user entered during setup (stored via /api/onboarding/api-key)
 *   3. A server-level environment variable (deployment-wide fallback)
 * Async because (2) is a DB read — added 2026-08-27 so users don't have to
 * rely on the server operator setting environment variables for them.
 */
async function resolveKey(agent: AgentConfig): Promise<string | undefined> {
  if (agent.apiKey) return agent.apiKey;

  const stored = await getApiKey(agent.provider).catch(() => null);
  if (stored) return stored;

  const envMap: Record<string, string | undefined> = {
    openai:     process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY,
    anthropic:  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    google:     process.env.GEMINI_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    minimax:    process.env.MINIMAX_API_KEY,
    ollama:     "ollama",
    custom:     agent.apiKey,
  };
  return envMap[agent.provider];
}
function resolveBaseUrl(agent: AgentConfig): string | undefined {
  if (agent.baseUrl) return agent.baseUrl;
  if (agent.provider === "openai")    return process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (agent.provider === "anthropic") return process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  return PROVIDER_URLS[agent.provider];
}

// ── Agentic loop (Anthropic + tools) ─────────────────────────

type AnthMsgParam = Anthropic.Messages.MessageParam;

/**
 * Run a full agentic loop for an Anthropic agent with tools enabled.
 * Handles multiple rounds of tool calls until stop_reason === 'end_turn'.
 */
async function runAgenticLoop(
  client: Anthropic,
  agent: AgentConfig,
  initialMessages: AnthMsgParam[],
  systemMsg: string,
  onToken?: (t: string) => void,
  onToolEvent?: (e: ToolEvent) => void,
): Promise<{ content: string; inputTokens: number; outputTokens: number; toolCalls: ToolCallRecord[] }> {
  let messages: AnthMsgParam[] = [...initialMessages];
  let content = "";
  let inputTokens = 0;
  let outputTokens = 0;
  const allToolCalls: ToolCallRecord[] = [];
  const MAX_ITERATIONS = 10;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await client.messages.create({
      model:      agent.model,
      max_tokens: 8192,
      system:     systemMsg,
      messages,
      tools:      TOOL_DEFINITIONS,
    });

    inputTokens  += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    // Extract any text blocks in this response
    const textBlock = response.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text");
    if (textBlock) content = textBlock.text;

    if (response.stop_reason === "end_turn") {
      // Stream the final text back in chunks so the SSE consumer sees tokens arriving
      if (onToken && content) {
        const CHUNK = 6;
        for (let i = 0; i < content.length; i += CHUNK) {
          onToken(content.slice(i, i + CHUNK));
        }
      }
      break;
    }

    if (response.stop_reason === "tool_use") {
      // Append assistant turn (includes tool_use blocks) to the conversation
      messages.push({ role: "assistant", content: response.content });

      // Execute each tool call
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== "tool_use") continue;

        const toolUse = block as Anthropic.Messages.ToolUseBlock;
        const input   = toolUse.input as Record<string, unknown>;

        // Notify route so it can emit SSE tool_start event
        onToolEvent?.({ type: "tool_start", name: toolUse.name, input });
        const t0 = Date.now();

        try {
          const result    = await dispatchTool(toolUse.name, input);
          const durationMs = Date.now() - t0;
          onToolEvent?.({ type: "tool_result", name: toolUse.name, result: result.slice(0, 300), durationMs });
          allToolCalls.push({ name: toolUse.name, input, result, durationMs });
          toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
        } catch (err) {
          const error      = err instanceof Error ? err.message : String(err);
          const durationMs = Date.now() - t0;
          onToolEvent?.({ type: "tool_error", name: toolUse.name, error, durationMs });
          allToolCalls.push({ name: toolUse.name, input, result: `Error: ${error}`, durationMs, error });
          toolResults.push({
            type:       "tool_result",
            tool_use_id: toolUse.id,
            content:    `Error executing ${toolUse.name}: ${error}`,
            is_error:   true,
          });
        }
      }

      // Append tool results as a user turn
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Any other stop reason (max_tokens, stop_sequence) — take whatever text we have
    if (onToken && content) onToken(content);
    break;
  }

  return { content, inputTokens, outputTokens, toolCalls: allToolCalls };
}

// ── Anthropic ask ─────────────────────────────────────────────
async function askAnthropic(
  agent: AgentConfig,
  messages: ChatMessage[],
  onToken?: (t: string) => void,
  onToolEvent?: (e: ToolEvent) => void,
): Promise<AgentResponse> {
  const apiKey  = await resolveKey(agent);
  const baseURL = resolveBaseUrl(agent);
  if (!apiKey) throw new Error("Anthropic API key not configured");

  const client    = new Anthropic({ apiKey, baseURL: baseURL ?? undefined });
  const systemMsg = messages.find((m) => m.role === "system")?.content ?? agent.systemPrompt;
  const chatMsgs: AnthMsgParam[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const t0 = Date.now();
  let content = "";
  let inputTokens  = 0;
  let outputTokens = 0;
  let toolCalls: ToolCallRecord[] = [];

  if (agent.useTools) {
    // ── Agentic loop (tool-capable orchestrator) ──────────────
    const loop = await runAgenticLoop(client, agent, chatMsgs, systemMsg, onToken, onToolEvent);
    content      = loop.content;
    inputTokens  = loop.inputTokens;
    outputTokens = loop.outputTokens;
    toolCalls    = loop.toolCalls;
  } else if (onToken) {
    // ── Standard streaming (no tools) ────────────────────────
    const stream = client.messages.stream({
      model:      agent.model,
      max_tokens: 8192,
      system:     systemMsg,
      messages:   chatMsgs,
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        content += event.delta.text;
        onToken(event.delta.text);
      }
    }
    const final  = await stream.finalMessage();
    inputTokens  = final.usage.input_tokens;
    outputTokens = final.usage.output_tokens;
  } else {
    // ── Standard non-streaming (no tools) ────────────────────
    const msg    = await client.messages.create({
      model:      agent.model,
      max_tokens: 8192,
      system:     systemMsg,
      messages:   chatMsgs,
    });
    const block  = msg.content[0];
    content      = block?.type === "text" ? block.text : "";
    inputTokens  = msg.usage.input_tokens;
    outputTokens = msg.usage.output_tokens;
  }

  const tokens    = inputTokens + outputTokens;
  const latencyMs = Date.now() - t0;
  return {
    agentId:  agent.id,
    content,
    model:    agent.model,
    latencyMs,
    tokens,
    costUsd:  costForTokens(agent.model, tokens),
    energyWh: energyForTokens(tokens),
    toolCalls: toolCalls.length ? toolCalls : undefined,
  };
}

// ── OpenAI-compatible ask (no tool support yet) ───────────────
async function askOpenAI(
  agent: AgentConfig,
  messages: ChatMessage[],
  onToken?: (t: string) => void,
): Promise<AgentResponse> {
  const apiKey  = await resolveKey(agent);
  const baseURL = resolveBaseUrl(agent);
  if (!apiKey) throw new Error(`API key not configured for provider ${agent.provider}`);

  const client = new OpenAI({ apiKey, baseURL: baseURL ?? undefined });
  const msgs = messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));
  if (!msgs.find((m) => m.role === "system")) {
    msgs.unshift({ role: "system", content: agent.systemPrompt });
  }

  const t0 = Date.now();
  let content = "";
  let tokens  = 0;

  if (onToken) {
    const stream = await client.chat.completions.create({
      model: agent.model, messages, max_completion_tokens: 8192, stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) { content += delta; onToken(delta); }
    }
    tokens = Math.ceil(content.length / 4);
  } else {
    const res = await client.chat.completions.create({
      model: agent.model, messages, max_completion_tokens: 8192,
    });
    content = res.choices[0]?.message?.content ?? "";
    tokens  = res.usage?.total_tokens ?? Math.ceil(content.length / 4);
  }

  const latencyMs = Date.now() - t0;
  return {
    agentId:  agent.id,
    content,
    model:    agent.model,
    latencyMs,
    tokens,
    costUsd:  costForTokens(agent.model, tokens),
    energyWh: energyForTokens(tokens),
  };
}

// ── Public gateway ────────────────────────────────────────────
export async function askAgent(
  agent: AgentConfig,
  messages: ChatMessage[],
  onToken?: (t: string) => void,
  onToolEvent?: (e: ToolEvent) => void,
): Promise<AgentResponse> {
  try {
    if (agent.provider === "anthropic") {
      return await askAnthropic(agent, messages, onToken, onToolEvent);
    }
    return await askOpenAI(agent, messages, onToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { agentId: agent.id, content: "", model: agent.model, latencyMs: 0, tokens: 0, costUsd: 0, energyWh: 0, error: msg };
  }
}

export async function isAgentAvailable(agent: AgentConfig): Promise<boolean> {
  if (!agent.enabled) return false;
  return !!(await resolveKey(agent));
}
