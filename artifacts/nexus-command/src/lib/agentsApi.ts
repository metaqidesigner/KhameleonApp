const BASE = import.meta.env.VITE_API_URL || '/api';

export type Provider = 'anthropic'|'openai'|'google'|'openrouter'|'ollama'|'minimax'|'custom';
export type AgentStatus = 'online'|'standby'|'offline'|'busy';
export type AgentRole = 'general'|'research'|'code'|'analysis'|'creative';

export interface AgentConfig {
  id: string;
  name: string;
  provider: Provider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
  role: AgentRole;
  systemPrompt: string;
  color: string;
  initials: string;
}

export interface AgentStatusInfo {
  agentId: string;
  status: AgentStatus;
  latencyMs?: number;
  model: string;
  provider: Provider;
}

export interface AgentMetrics {
  agentId: string;
  queries: number;
  avgLatencyMs: number;
  avgTokens: number;
  totalCostUsd: number;
  totalEnergyWh: number;
  qualityScore: number;
  lastActive?: string;
}

export interface ConversationEntry {
  id: string;
  agentId: string;
  userMessage: string;
  assistantMessage: string;
  model: string;
  ts: number;
  latencyMs: number;
  tokens: number;
  costUsd: number;
}

export interface ChatMessage { role: 'user'|'assistant'|'system'; content: string; }

export interface AgentResponse {
  agentId: string;
  content: string;
  model: string;
  latencyMs: number;
  tokens: number;
  costUsd: number;
  energyWh: number;
  error?: string;
}

export interface CompareResult {
  agentId: string; content: string; latencyMs: number;
  tokens: number; costUsd: number; error?: string;
}

// ── Fallback roster shown when backend is offline ─────────
export const FALLBACK_ROSTER: AgentConfig[] = [
  { id:'claude',     name:'CLAUDE',     provider:'anthropic', model:'claude-sonnet-4-6', enabled:true, role:'general',  systemPrompt:'', color:'#c9a84c', initials:'CL' },
  { id:'gpt4o',      name:'GPT-4o',     provider:'openai',    model:'gpt-4o',            enabled:true, role:'general',  systemPrompt:'', color:'#00d4ff', initials:'GP' },
  { id:'gemini',     name:'GEMINI',     provider:'google',    model:'gemini-2.0-flash',  enabled:true, role:'research', systemPrompt:'', color:'#3fb950', initials:'GM' },
  { id:'openrouter', name:'OPENROUTER', provider:'openrouter',model:'mistral-7b-instruct',enabled:true,role:'general',  systemPrompt:'', color:'#a78bfa', initials:'OR' },
  { id:'local',      name:'LOCAL',      provider:'ollama',    model:'llama3.2',           enabled:true, role:'code',     systemPrompt:'', color:'#f97316', initials:'LC' },
  { id:'minimax',    name:'MINIMAX',    provider:'minimax',   model:'abab6.5s-chat',      enabled:true, role:'creative', systemPrompt:'', color:'#ec4899', initials:'MM' },
];

async function safeFetch<T>(url: string, opts?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json() as T;
  } catch {
    if (fallback !== undefined) return fallback;
    throw new Error('Backend unreachable');
  }
}

export async function getRoster(): Promise<AgentConfig[]> {
  return safeFetch<AgentConfig[]>(`${BASE}/agents/roster`, undefined, FALLBACK_ROSTER);
}

export async function upsertAgent(agent: Partial<AgentConfig>): Promise<AgentConfig> {
  return safeFetch<AgentConfig>(`${BASE}/agents/roster`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(agent),
  });
}

export async function deleteAgent(id: string): Promise<{ ok: boolean }> {
  return safeFetch<{ ok: boolean }>(`${BASE}/agents/roster/${id}`, { method: 'DELETE' }, { ok: false });
}

export async function getAgentStatus(id: string): Promise<AgentStatusInfo> {
  return safeFetch<AgentStatusInfo>(`${BASE}/agents/${id}/status`, undefined, {
    agentId: id, status: 'standby', model: '—', provider: 'custom',
  });
}

export async function getAgentMetrics(id: string): Promise<AgentMetrics> {
  return safeFetch<AgentMetrics>(`${BASE}/agents/${id}/metrics`, undefined, {
    agentId: id, queries: 0, avgLatencyMs: 0, avgTokens: 0,
    totalCostUsd: 0, totalEnergyWh: 0, qualityScore: 0,
  });
}

export async function getAllMetrics(): Promise<AgentMetrics[]> {
  return safeFetch<AgentMetrics[]>(`${BASE}/agents/metrics`, undefined, []);
}

export async function getAgentHistory(id: string): Promise<ConversationEntry[]> {
  return safeFetch<ConversationEntry[]>(`${BASE}/agents/${id}/history`, undefined, []);
}

export async function askAgent(id: string, messages: ChatMessage[]): Promise<AgentResponse> {
  return safeFetch<AgentResponse>(`${BASE}/agents/${id}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, stream: false }),
  }, {
    agentId: id, content: 'AGENT OFFLINE — Configure API key in Settings.',
    model: 'offline', latencyMs: 0, tokens: 0, costUsd: 0, energyWh: 0,
  });
}

export interface StreamDone {
  agentId: string; model: string; latencyMs: number; tokens: number; costUsd: number;
}

export function streamAgentChat(
  agentId: string,
  messages: ChatMessage[],
  onToken: (t: string) => void,
  onDone: (d: StreamDone) => void,
  onError: (e: string) => void,
): () => void {
  let closed = false;
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE}/agents/${agentId}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, stream: true }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done || closed) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const d = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (d.token)  onToken(d.token as string);
            if (d.error)  onError(d.error as string);
            if (d.done)   onDone({ agentId: d.agentId as string, model: d.model as string, latencyMs: d.latencyMs as number, tokens: d.tokens as number, costUsd: d.costUsd as number });
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      if (!closed) onError(err instanceof Error ? err.message : 'Stream failed');
    }
  })();

  return () => { closed = true; ctrl.abort(); };
}

export async function compareAgents(prompt: string, agentIds: string[]): Promise<{ prompt: string; comparison: CompareResult[] }> {
  return safeFetch<{ prompt: string; comparison: CompareResult[] }>(
    `${BASE}/agents/compare`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, agent_ids: agentIds }) },
    { prompt, comparison: [] },
  );
}

export async function askAll(
  messages: ChatMessage[],
  agentIds?: string[],
  mode: 'parallel'|'vote' = 'parallel',
): Promise<{ results: AgentResponse[]; verdict?: AgentResponse; mode: string }> {
  return safeFetch(
    `${BASE}/agents/ask-all`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, agent_ids: agentIds, mode }) },
    { results: [], mode },
  );
}

// Provider display helpers
export const PROVIDER_LABELS: Record<Provider, string> = {
  anthropic:'Anthropic', openai:'OpenAI', google:'Google',
  openrouter:'OpenRouter', ollama:'Ollama', minimax:'MiniMax', custom:'Custom',
};

export const STATUS_COLOR: Record<AgentStatus, string> = {
  online:'var(--j-green)', standby:'var(--j-cyan)', offline:'var(--j-text-faint)', busy:'#c9a84c',
};
