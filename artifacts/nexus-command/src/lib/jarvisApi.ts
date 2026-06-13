const BASE = import.meta.env.VITE_API_URL || '/api';

async function safeFetch<T>(url: string, opts?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    if (fallback !== undefined) return fallback;
    throw new Error('Jarvis backend unreachable');
  }
}

// ── Types ─────────────────────────────────────────────────
export interface JarvisHealth {
  status: 'online' | 'degraded' | 'offline';
  engine: string;
  model: string;
  uptime: number;
  gpu?: string;
  vram_gb?: number;
  tokens_per_sec?: number;
  watt_per_query?: number;
  total_queries?: number;
  total_cost_usd?: number;
  avg_latency_ms?: number;
}

export interface JarvisConnector {
  id: string;
  name: string;
  connected: boolean;
  last_sync?: string;
  icon?: string;
}

export interface JarvisSkill {
  id: string;
  name: string;
  description: string;
  source: string;
}

export interface AskResponse {
  content: string;
  tool_results: unknown[];
  model: string;
  latency_ms?: number;
  tokens?: number;
  cost_usd?: number;
  energy_wh?: number;
}

export interface AgentStats {
  queries: number;
  avg_cost: number;
  total_cost: number;
}

export interface JarvisTelemetry {
  queries: { ts: number; agent: string; latency_ms: number; cost_usd: number; energy_wh: number }[];
  energy_wh: number;
  cost_usd: number;
  avg_latency_ms: number;
  by_agent: Record<string, AgentStats>;
  total_queries: number;
  memory_chunks?: number;
}

// ── Fallbacks ──────────────────────────────────────────────
const OFFLINE_HEALTH: JarvisHealth = {
  status: 'offline',
  engine: 'none',
  model: '—',
  uptime: 0,
  gpu: '—',
  vram_gb: 0,
  tokens_per_sec: 0,
  watt_per_query: 0,
  total_queries: 0,
  total_cost_usd: 0,
  avg_latency_ms: 0,
};

export const KNOWN_AGENTS = [
  'simple', 'orchestrator', 'deep_research',
  'morning_digest', 'code_assistant', 'channel_agent',
  'proactive_agent', 'operative',
] as const;

const MOCK_CONNECTORS: JarvisConnector[] = [
  { id: 'gmail', name: 'Gmail', connected: false },
  { id: 'gcalendar', name: 'Google Calendar', connected: false },
  { id: 'slack', name: 'Slack', connected: false },
  { id: 'notion', name: 'Notion', connected: false },
  { id: 'gdrive', name: 'Google Drive', connected: false },
  { id: 'github', name: 'GitHub', connected: false },
  { id: 'discord', name: 'Discord', connected: false },
  { id: 'telegram', name: 'Telegram', connected: false },
  { id: 'whatsapp', name: 'WhatsApp', connected: false },
  { id: 'ticktick', name: 'TickTick', connected: false },
  { id: 'obsidian', name: 'Obsidian', connected: false },
  { id: 'dropbox', name: 'Dropbox', connected: false },
];

const MOCK_SKILLS: JarvisSkill[] = [
  { id: 'arxiv', name: 'ArXiv', description: 'Search academic papers', source: 'hermes:arxiv' },
  { id: 'weather', name: 'Weather', description: 'Real-time weather data', source: 'hermes:weather' },
  { id: 'news', name: 'News Digest', description: 'Top news summary', source: 'hermes:news' },
];

const MOCK_TELEMETRY: JarvisTelemetry = {
  queries: [],
  energy_wh: 0,
  cost_usd: 0,
  avg_latency_ms: 0,
  by_agent: {},
  total_queries: 0,
  memory_chunks: 0,
};

// ── API functions ──────────────────────────────────────────
export async function getHealth(): Promise<JarvisHealth> {
  return safeFetch<JarvisHealth>(`${BASE}/health`, undefined, OFFLINE_HEALTH);
}

export async function getTelemetry(): Promise<JarvisTelemetry> {
  return safeFetch<JarvisTelemetry>(`${BASE}/telemetry`, undefined, MOCK_TELEMETRY);
}

export async function getAgents(): Promise<string[]> {
  return safeFetch<string[]>(`${BASE}/agents`, undefined, [...KNOWN_AGENTS]);
}

export async function getConnectors(): Promise<JarvisConnector[]> {
  return safeFetch<JarvisConnector[]>(`${BASE}/connectors`, undefined, MOCK_CONNECTORS);
}

export async function getSkills(): Promise<JarvisSkill[]> {
  return safeFetch<JarvisSkill[]>(`${BASE}/skills`, undefined, MOCK_SKILLS);
}

export async function getCurrentMode(): Promise<{ name: string }> {
  return safeFetch<{ name: string }>(`${BASE}/modes/current`, undefined, { name: 'work' });
}

export async function askJarvis(
  prompt: string,
  agent?: string,
  tools?: string[],
): Promise<AskResponse> {
  return safeFetch<AskResponse>(
    `${BASE}/ask`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, agent, tools }),
    },
    {
      content: `[offline] "${prompt}"\n\nConnect a Jarvis backend — set ANTHROPIC_API_KEY or OPENAI_API_KEY, then restart.`,
      tool_results: [],
      model: 'demo',
      latency_ms: 0,
      tokens: 0,
      cost_usd: 0,
      energy_wh: 0,
    },
  );
}

export async function searchMemory(q: string): Promise<{ content: string; source: string; score: number; chunk_id?: string; ts?: string }[]> {
  return safeFetch(
    `${BASE}/memory/search?q=${encodeURIComponent(q)}`,
    undefined,
    [
      { content: `Demo memory result for "${q}"`, source: '/demo/path.txt', score: 0.92, chunk_id: 'c001', ts: new Date().toISOString() },
      { content: 'Another cached fact from your knowledge base.', source: '/demo/notes.md', score: 0.78, chunk_id: 'c002', ts: new Date().toISOString() },
    ],
  );
}

export async function indexMemoryPath(path: string): Promise<{ ok: boolean; chunks?: number }> {
  return safeFetch(
    `${BASE}/memory/index`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    },
    { ok: true, chunks: 42 },
  );
}

export async function installSkill(source: string): Promise<{ ok: boolean }> {
  return safeFetch(
    `${BASE}/skills/install`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source }),
    },
    { ok: true },
  );
}

export async function runResearch(query: string, opts?: { max_iterations?: number; web_search?: boolean }): Promise<AskResponse> {
  return safeFetch(
    `${BASE}/research`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, ...opts }),
    },
    {
      content: `## Research: ${query}\n\nThis is demo research output. Connect a Jarvis backend with an API key to run real deep-research queries.\n\n### Key findings\n- Query received.\n- No live backend connected.\n- Install Ollama or set an API key to proceed.`,
      tool_results: [],
      model: 'demo',
      latency_ms: 0,
      tokens: 0,
      cost_usd: 0,
      energy_wh: 0,
    },
  );
}

// ── WebSocket streaming ────────────────────────────────────
export interface StreamDonePayload {
  model: string | null;
  latency_ms?: number;
  tokens?: number;
  cost_usd?: number;
  energy_wh?: number;
}

type WsCleanup = () => void;

export function streamChat(
  prompt: string,
  agent: string,
  onToken: (token: string) => void,
  onDone: (payload: StreamDonePayload) => void,
): WsCleanup {
  const origin = window.location.origin.replace(/^http/, 'ws');
  const wsBase = `${origin}/api`;

  let ws: WebSocket | null = null;
  let closed = false;

  const fallback = (reason?: string) => {
    if (closed) return;
    closed = true;
    const txt = `[offline — ${reason ?? 'no backend'}] You asked: "${prompt}"\n\nConfigure a Jarvis backend to get real responses.`;
    let i = 0;
    const id = setInterval(() => {
      if (i < txt.length) onToken(txt[i++]);
      else { clearInterval(id); onDone({ model: 'demo', latency_ms: 0, tokens: txt.length, cost_usd: 0, energy_wh: 0 }); }
    }, 14);
    return () => clearInterval(id);
  };

  try {
    ws = new WebSocket(`${wsBase}/ws/chat`);

    ws.onopen = () => {
      if (!closed && ws) ws.send(JSON.stringify({ prompt, agent }));
    };

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data as string) as Record<string, unknown>;
        if (d.token) onToken(d.token as string);
        if (d.done) {
          onDone({
            model: (d.model as string) ?? null,
            latency_ms: d.latency_ms as number | undefined,
            tokens: d.tokens as number | undefined,
            cost_usd: d.cost_usd as number | undefined,
            energy_wh: d.energy_wh as number | undefined,
          });
          ws?.close();
        }
      } catch { /* ignore parse errors */ }
    };

    ws.onerror = () => fallback('WS error');
    ws.onclose = () => { /* handled by onDone */ };
  } catch {
    fallback('WS unavailable');
  }

  return () => {
    closed = true;
    ws?.close();
  };
}
