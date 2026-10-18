import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AgentConfig, AgentResponse, ChatMessage, Provider, ToolCallRecord, ToolEvent } from "./types.js";
import { TOOL_DEFINITIONS } from "./tools/definitions.js";
import { dispatchTool } from "./tools/dispatcher.js";
import { getCustomToolDefinitions, isCustomToolName, dispatchCustomTool, getMcpServerConfigs } from "./tools/customIntegrations.js";
import { askKhami, khamiStatus } from "../engines/khami.js";
import { toolsForAnyAi } from "./tools/anyAiTools.js";
import { askCopilot } from "../lib/copilotChat.js";
import { getToken } from "../lib/oauthTokens.js";
import { pickSkill, skillInstructions } from "../lib/skillPicker.js";
import { loadInstalledSkills, buildSkillCatalogPrompt, useSkillResult, USE_SKILL_TOOL, USE_SKILL_TOOL_NAME, type InstalledSkill } from "../lib/installedSkills.js";
import { getApiKey } from "../lib/apiKeys.js";
import { trackingFetch } from "../lib/providerQuota.js";

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

  // design-spec.md §16.6: a user-imported OpenAPI spec's operations become
  // real tools here, merged with the static, first-party TOOL_DEFINITIONS -
  // the model sees one combined catalog, no special-casing in its prompt.
  const [customTools, mcpServers, installedSkills] = await Promise.all([
    getCustomToolDefinitions(),
    getMcpServerConfigs(),
    // A skills lookup failure must never break chat - just run without them.
    loadInstalledSkills().catch((): InstalledSkill[] => []),
  ]);
  // Installed skills: names/descriptions in the system prompt, full steps
  // on demand via use_skill (lib/installedSkills.ts).
  const tools = [...TOOL_DEFINITIONS, ...customTools, ...(installedSkills.length ? [USE_SKILL_TOOL] : [])];
  systemMsg = systemMsg + buildSkillCatalogPrompt(installedSkills);
  // A connected MCP server needs the beta Messages API's `mcp_servers` -
  // Claude talks to that server directly and resolves its tool calls
  // server-side (mcp_tool_use/mcp_tool_result content blocks come back
  // already paired, nothing for this loop to dispatch). Decided once per
  // loop run, not per iteration, so one run never mixes API surfaces.
  const useBeta = mcpServers.length > 0;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // Both calls return the same fields this loop actually reads
    // (content/stop_reason/usage) - BetaMessage adds MCP-specific content
    // block types on top of the same shape, so one `as` boundary here
    // keeps the rest of this function's logic identical for both paths
    // rather than duplicating the whole loop per API surface.
    const response = (useBeta
      ? await client.beta.messages.create({ model: agent.model, max_tokens: 8192, system: systemMsg, messages, tools, mcp_servers: mcpServers })
      : await client.messages.create({ model: agent.model, max_tokens: 8192, system: systemMsg, messages, tools })
    ) as Anthropic.Messages.Message;

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
          const result    = toolUse.name === USE_SKILL_TOOL_NAME
            ? useSkillResult(installedSkills, String(input.name ?? ""))
            : isCustomToolName(toolUse.name)
            ? await dispatchCustomTool(toolUse.name, input)
            : await dispatchTool(toolUse.name, input);
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

  const client    = new Anthropic({ apiKey, baseURL: baseURL ?? undefined, fetch: trackingFetch("anthropic") });
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

  // Rate-limit header tracking (providerQuota.ts) only applies to the real
  // OpenAI API - google/openrouter/minimax/ollama/custom share this same
  // OpenAI-compatible code path via a different baseURL, but nothing
  // confirms they send the same x-ratelimit-* headers, so they're left
  // untracked rather than guessed at.
  const client = new OpenAI({
    apiKey, baseURL: baseURL ?? undefined,
    ...(agent.provider === "openai" ? { fetch: trackingFetch("openai") } : {}),
  });
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

// ── Skills for any AI ─────────────────────────────────────────
async function withPickedSkill(
  agent: AgentConfig,
  messages: ChatMessage[],
  onToolEvent?: (e: ToolEvent) => void,
): Promise<ChatMessage[]> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const skills = await loadInstalledSkills().catch((): InstalledSkill[] => []);
  const pick = pickSkill(lastUser, skills);
  if (!pick) return messages;
  onToolEvent?.({ type: "tool_start", name: USE_SKILL_TOOL_NAME, input: { name: pick.skill.name } });
  onToolEvent?.({ type: "tool_result", name: USE_SKILL_TOOL_NAME, result: `Using ${pick.skill.name}`, durationMs: 0 });
  const system = messages.find((m) => m.role === "system")?.content ?? agent.systemPrompt;
  return [
    { role: "system", content: system + skillInstructions(pick.skill) },
    ...messages.filter((m) => m.role !== "system"),
  ];
}

// ── Public gateway ────────────────────────────────────────────
export async function askAgent(
  agent: AgentConfig,
  messages: ChatMessage[],
  onToken?: (t: string) => void,
  onToolEvent?: (e: ToolEvent) => void,
  /** plain: an internal job (lib/askAI.ts) - no skill picking and no tools, just the answer. */
  opts: { plain?: boolean } = {},
): Promise<AgentResponse> {
  try {
    if (opts.plain) agent = { ...agent, useTools: false };
    // Claude with tools fetches skills itself (use_skill). Every other AI -
    // Khami, GPT, Gemini - gets the matching skill picked by Khameleon and
    // handed over in its instructions (lib/skillPicker.ts). Reported as a
    // use_skill event so the chat shows "Using: <skill>" either way.
    if (!opts.plain && !(agent.provider === "anthropic" && agent.useTools)) {
      messages = await withPickedSkill(agent, messages, onToolEvent);
    }
    if (agent.provider === "copilot") {
      // Copilot takes no tools; the picked skill travels in its instructions.
      const systemMsg = messages.find((m) => m.role === "system")?.content ?? agent.systemPrompt;
      const r = await askCopilot(systemMsg, messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role as "user" | "assistant", content: m.content })));
      onToken?.(r.content); // Copilot's API answers in one piece here
      return { agentId: agent.id, content: r.content, model: "Microsoft 365 Copilot", latencyMs: r.latencyMs, tokens: Math.ceil(r.content.length / 4), costUsd: 0, energyWh: 0 };
    }
    if (agent.provider === "khami") {
      const systemMsg = messages.find((m) => m.role === "system")?.content ?? agent.systemPrompt;
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
      const tools = opts.plain ? [] : await toolsForAnyAi(lastUser).catch(() => []);
      const r = await askKhami({
        system: tools.length
          ? systemMsg + "\n\nYou can use the tools provided when they help. Afterwards, tell the user the outcome in a sentence or two. Don't narrate attempts; if something can't be done, say so once, plainly."
          : systemMsg,
        messages: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        onToken,
        tools,
        onToolEvent: onToolEvent as ((e: import("../engines/types.js").EngineToolEvent) => void) | undefined,
      });
      // On this computer: no per-use cost, and energy isn't estimated for local runs.
      // The brain's own name stays on the Licences page, not in the product.
      return { agentId: agent.id, content: r.content, model: "Khami", latencyMs: r.latencyMs, tokens: r.tokens, costUsd: 0, energyWh: 0 };
    }
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
  if (agent.provider === "khami") return (await khamiStatus()).available;
  if (agent.provider === "copilot") return !!(await getToken("copilot").catch(() => null));
  return !!(await resolveKey(agent));
}
