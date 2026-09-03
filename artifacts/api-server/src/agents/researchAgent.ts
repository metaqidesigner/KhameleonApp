/**
 * Deep-research agent for POST /api/research (routes/research.ts).
 *
 * Distinct from gateway.ts's runAgenticLoop (used by chat agents), which
 * grants the full TOOL_DEFINITIONS set - file read/write, shell, task CRUD.
 * A research query only ever needs to read the web, so this loop exposes
 * ONLY the fetch_url tool regardless of what else exists - least privilege,
 * the same principle already applied to every Outlook skill's connector
 * scope (§11.2: "a skill's declared scope can never exceed what it needs").
 *
 * Built because pages/research.tsx's "Initiate Research" button called
 * POST /api/research, but this router only ever had a GET / handler
 * (research_items listing) - the button always 404'd and silently showed
 * a canned "JARVIS is offline" fallback, in every environment, regardless
 * of configuration. Found by code inspection during the 2026-09-03
 * backend-route audit, not by running it.
 */

import Anthropic from "@anthropic-ai/sdk";
import { dispatchTool } from "./tools/dispatcher.js";
import { TOOL_DEFINITIONS } from "./tools/definitions.js";
import { costForTokens } from "./gateway.js";

const FETCH_URL_TOOL = TOOL_DEFINITIONS.find((t) => t.name === "fetch_url");
if (!FETCH_URL_TOOL) {
  throw new Error("researchAgent: fetch_url tool definition not found in TOOL_DEFINITIONS");
}

const MODEL = "claude-sonnet-4-6";

function getClient(): Anthropic {
  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? undefined,
  });
}

export interface ResearchToolResult {
  name: string;
  input: Record<string, unknown>;
  result: string;
  durationMs: number;
  error?: string;
}

export interface ResearchResult {
  content: string;
  tool_results: ResearchToolResult[];
  model: string;
  latency_ms: number;
  tokens: number;
  cost_usd: number;
}

/** Clamped to a sane range - an unbounded value from the request body could otherwise run an unbounded number of tool-call rounds. */
export function clampIterations(raw: unknown, fallback = 3): number {
  // Number(null) === 0 (finite!), so null must be excluded explicitly before
  // the coercion below, or it silently clamps to 1 instead of using fallback.
  if (raw === null || raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), 1), 10);
}

export async function runDeepResearch(
  query: string,
  opts: { maxIterations?: unknown; webSearch?: boolean } = {}
): Promise<ResearchResult> {
  const maxIterations = clampIterations(opts.maxIterations);
  const webSearch = opts.webSearch !== false;

  const client = getClient();
  const t0 = Date.now();
  const tools = webSearch ? [FETCH_URL_TOOL!] : [];
  const system = [
    "You are a research assistant. Answer the user's query thoroughly and accurately.",
    webSearch
      ? "You have a fetch_url tool to read real web pages - use it to verify facts and cite real sources rather than relying only on prior knowledge."
      : "Web access is disabled for this query - answer from your own knowledge and say so plainly if you're not confident.",
    "Format your final answer as clean markdown.",
  ].join(" ");

  let messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: query }];
  let content = "";
  let inputTokens = 0;
  let outputTokens = 0;
  const toolResults: ResearchToolResult[] = [];

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system,
      messages,
      ...(tools.length ? { tools } : {}),
    });

    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    const textBlock = response.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text");
    if (textBlock) content = textBlock.text;

    if (response.stop_reason !== "tool_use") break;

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.Messages.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const input = block.input as Record<string, unknown>;
      const start = Date.now();
      try {
        const result = await dispatchTool(block.name, input);
        toolResults.push({ name: block.name, input, result, durationMs: Date.now() - start });
        results.push({ type: "tool_result", tool_use_id: block.id, content: result });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        toolResults.push({ name: block.name, input, result: `Error: ${error}`, durationMs: Date.now() - start, error });
        results.push({ type: "tool_result", tool_use_id: block.id, content: `Error: ${error}`, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }

  const tokens = inputTokens + outputTokens;
  return {
    content: content || "_No answer was generated before the iteration limit was reached. Try raising Max Iterations or narrowing the query._",
    tool_results: toolResults,
    model: MODEL,
    latency_ms: Date.now() - t0,
    tokens,
    cost_usd: costForTokens(MODEL, tokens),
  };
}
