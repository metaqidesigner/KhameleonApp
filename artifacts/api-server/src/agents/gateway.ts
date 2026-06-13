import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { AgentConfig, AgentResponse, ChatMessage, Provider } from './types.js';

// ── Cost tables (USD per 1k tokens) ────────────────────────
const COST_TABLE: Record<string, number> = {
  'claude-sonnet-4-6': 0.009,
  'claude-opus-4-8':   0.045,
  'claude-haiku-4-5':  0.0005,
  'gpt-4o':            0.0075,
  'gpt-5.4':           0.010,
  'gpt-4o-mini':       0.0003,
  'gemini-2.0-flash':  0.00010,
  'gemini-1.5-pro':    0.00175,
};
const ENERGY_PER_1K = 0.001; // Wh estimate for cloud

function costForTokens(model: string, tokens: number): number {
  const rate = COST_TABLE[model] ?? 0.002;
  return (tokens / 1000) * rate;
}
function energyForTokens(tokens: number): number {
  return (tokens / 1000) * ENERGY_PER_1K;
}

// ── Provider base URLs ──────────────────────────────────────
const PROVIDER_URLS: Partial<Record<Provider, string>> = {
  google:      'https://generativelanguage.googleapis.com/v1beta/openai/',
  openrouter:  'https://openrouter.ai/api/v1',
  ollama:      'http://localhost:11434/v1',
  minimax:     'https://api.minimax.chat/v1',
};

// ── Key resolution ──────────────────────────────────────────
function resolveKey(agent: AgentConfig): string | undefined {
  if (agent.apiKey) return agent.apiKey;
  const envMap: Record<string, string | undefined> = {
    openai:      process.env.AI_INTEGRATIONS_OPENAI_API_KEY    ?? process.env.OPENAI_API_KEY,
    anthropic:   process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY,
    google:      process.env.GEMINI_API_KEY,
    openrouter:  process.env.OPENROUTER_API_KEY,
    minimax:     process.env.MINIMAX_API_KEY,
    ollama:      'ollama',
    custom:      agent.apiKey,
  };
  return envMap[agent.provider];
}
function resolveBaseUrl(agent: AgentConfig): string | undefined {
  if (agent.baseUrl) return agent.baseUrl;
  if (agent.provider === 'openai')     return process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (agent.provider === 'anthropic')  return process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  return PROVIDER_URLS[agent.provider];
}

// ── Anthropic ask ───────────────────────────────────────────
async function askAnthropic(
  agent: AgentConfig,
  messages: ChatMessage[],
  onToken?: (t: string) => void,
): Promise<AgentResponse> {
  const apiKey  = resolveKey(agent);
  const baseURL = resolveBaseUrl(agent);
  if (!apiKey) throw new Error('Anthropic API key not configured');

  const client = new Anthropic({ apiKey, baseURL: baseURL ?? undefined });

  const systemMsg = messages.find(m => m.role === 'system')?.content ?? agent.systemPrompt;
  const chatMsgs  = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const t0 = Date.now();
  let content = '';
  let inputTokens  = 0;
  let outputTokens = 0;

  if (onToken) {
    const stream = client.messages.stream({
      model:      agent.model,
      max_tokens: 8192,
      system:     systemMsg,
      messages:   chatMsgs,
    });
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        content += event.delta.text;
        onToken(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    inputTokens  = final.usage.input_tokens;
    outputTokens = final.usage.output_tokens;
  } else {
    const msg = await client.messages.create({
      model:      agent.model,
      max_tokens: 8192,
      system:     systemMsg,
      messages:   chatMsgs,
    });
    const block = msg.content[0];
    content      = block.type === 'text' ? block.text : '';
    inputTokens  = msg.usage.input_tokens;
    outputTokens = msg.usage.output_tokens;
  }

  const tokens = inputTokens + outputTokens;
  const latencyMs = Date.now() - t0;
  return {
    agentId:   agent.id,
    content,
    model:     agent.model,
    latencyMs,
    tokens,
    costUsd:   costForTokens(agent.model, tokens),
    energyWh:  energyForTokens(tokens),
  };
}

// ── OpenAI-compatible ask ────────────────────────────────────
async function askOpenAI(
  agent: AgentConfig,
  messages: ChatMessage[],
  onToken?: (t: string) => void,
): Promise<AgentResponse> {
  const apiKey  = resolveKey(agent);
  const baseURL = resolveBaseUrl(agent);
  if (!apiKey) throw new Error(`API key not configured for provider ${agent.provider}`);

  const client = new OpenAI({ apiKey, baseURL: baseURL ?? undefined });

  const msgs = messages.map(m => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content }));
  if (!msgs.find(m => m.role === 'system')) {
    msgs.unshift({ role: 'system', content: agent.systemPrompt });
  }

  const t0 = Date.now();
  let content = '';
  let tokens  = 0;

  if (onToken) {
    const stream = await client.chat.completions.create({
      model:                agent.model,
      messages:             msgs,
      max_completion_tokens: 8192,
      stream:               true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) { content += delta; onToken(delta); }
    }
    tokens = Math.ceil(content.length / 4); // rough estimate if not returned
  } else {
    const res = await client.chat.completions.create({
      model:                agent.model,
      messages:             msgs,
      max_completion_tokens: 8192,
    });
    content = res.choices[0]?.message?.content ?? '';
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

// ── Public gateway function ──────────────────────────────────
export async function askAgent(
  agent: AgentConfig,
  messages: ChatMessage[],
  onToken?: (t: string) => void,
): Promise<AgentResponse> {
  try {
    if (agent.provider === 'anthropic') {
      return await askAnthropic(agent, messages, onToken);
    }
    return await askOpenAI(agent, messages, onToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      agentId:  agent.id,
      content:  '',
      model:    agent.model,
      latencyMs: 0,
      tokens:   0,
      costUsd:  0,
      energyWh: 0,
      error:    msg,
    };
  }
}

export function isAgentAvailable(agent: AgentConfig): boolean {
  if (!agent.enabled) return false;
  const key = resolveKey(agent);
  return !!key;
}
