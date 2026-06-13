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
  avg_latency: number;
  avg_tokens: number;
  avg_cost: number;
  total_cost: number;
  p95_latency?: number;
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

export interface FeedItem {
  id: string;
  ts: number;
  agent: string;
  prompt: string;
  latency_ms?: number;
  tokens?: number;
  cost_usd?: number;
}

// ── Fallbacks / Mock data ──────────────────────────────────
export const OFFLINE_HEALTH: JarvisHealth = {
  status: 'offline', engine: 'none', model: '—',
  uptime: 0, gpu: '—', vram_gb: 0,
  tokens_per_sec: 0, watt_per_query: 0,
  total_queries: 0, total_cost_usd: 0, avg_latency_ms: 0,
};

export const KNOWN_AGENTS = [
  'simple', 'orchestrator', 'deep_research',
  'morning_digest', 'code_assistant', 'channel_agent',
  'proactive_agent', 'operative',
] as const;

const MOCK_CONNECTORS: JarvisConnector[] = [
  { id: 'gmail', name: 'Gmail', connected: false },
  { id: 'gcal', name: 'Google Calendar', connected: false },
  { id: 'gdrive', name: 'Google Drive', connected: false },
  { id: 'gcontacts', name: 'Google Contacts', connected: false },
  { id: 'notion', name: 'Notion', connected: false },
  { id: 'slack', name: 'Slack', connected: false },
  { id: 'obsidian', name: 'Obsidian', connected: false },
  { id: 'github', name: 'GitHub', connected: false },
  { id: 'spotify', name: 'Spotify', connected: false },
  { id: 'strava', name: 'Strava', connected: false },
  { id: 'oura', name: 'Oura', connected: false },
  { id: 'apple_health', name: 'Apple Health', connected: false },
  { id: 'apple_notes', name: 'Apple Notes', connected: false },
  { id: 'hn', name: 'HackerNews', connected: false },
  { id: 'outlook', name: 'Outlook', connected: false },
  { id: 'weather', name: 'Weather', connected: false },
  { id: 'dropbox', name: 'Dropbox', connected: false },
  { id: 'ticktick', name: 'TickTick', connected: false },
  { id: 'whatsapp', name: 'WhatsApp', connected: false },
  { id: 'imessage', name: 'iMessage', connected: false },
  { id: 'granola', name: 'Granola', connected: false },
  { id: 'newsrss', name: 'News RSS', connected: false },
];

const MOCK_CHANNELS = [
  'Discord', 'Telegram', 'Slack', 'WhatsApp', 'Gmail',
  'Signal', 'Matrix', 'Mattermost', 'IRC', 'Reddit',
  'LINE', 'Webhook', 'Webchat', 'Zulip',
];

const MOCK_FEED: FeedItem[] = [
  { id: '1', ts: Date.now() - 60000, agent: 'simple',        prompt: 'Summarise my emails', latency_ms: 312, tokens: 450, cost_usd: 0 },
  { id: '2', ts: Date.now() - 180000, agent: 'deep_research', prompt: 'Research AI safety trends', latency_ms: 4200, tokens: 3200, cost_usd: 0.0003 },
  { id: '3', ts: Date.now() - 600000, agent: 'morning_digest', prompt: 'Morning briefing', latency_ms: 890, tokens: 820, cost_usd: 0 },
];

export const MOCK_TELEMETRY: JarvisTelemetry = {
  queries: [],
  energy_wh: 0,
  cost_usd: 0,
  avg_latency_ms: 0,
  by_agent: {},
  total_queries: 0,
  memory_chunks: 0,
};

export { MOCK_CHANNELS };

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
  return safeFetch<JarvisSkill[]>(`${BASE}/skills`, undefined, []);
}

export async function getCurrentMode(): Promise<{ name: string }> {
  return safeFetch<{ name: string }>(`${BASE}/modes/current`, undefined, { name: 'WORK' });
}

export async function getAgentFeed(): Promise<FeedItem[]> {
  return safeFetch<FeedItem[]>(`${BASE}/feed`, undefined, MOCK_FEED);
}

export async function askJarvis(prompt: string, agent?: string): Promise<AskResponse> {
  return safeFetch<AskResponse>(
    `${BASE}/ask`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, agent }),
    },
    {
      content: `JARVIS OFFLINE — Configure engine in Settings.\n\nYour query: "${prompt}"`,
      tool_results: [],
      model: 'offline',
    },
  );
}

export async function searchMemory(q: string) {
  return safeFetch<{ content: string; source: string; score: number; chunk_id?: string; ts?: string }[]>(
    `${BASE}/memory/search?q=${encodeURIComponent(q)}`,
    undefined,
    [
      { content: `Demo result for "${q}"`, source: '/demo/sample.txt', score: 0.91, chunk_id: 'c001', ts: new Date().toISOString() },
      { content: 'Another knowledge base fragment.', source: '/demo/notes.md', score: 0.74, chunk_id: 'c002', ts: new Date().toISOString() },
    ],
  );
}

export async function indexMemoryPath(path: string): Promise<{ ok: boolean; chunks?: number }> {
  return safeFetch(
    `${BASE}/memory/index`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) },
    { ok: true, chunks: 42 },
  );
}

export async function installSkill(source: string): Promise<{ ok: boolean }> {
  return safeFetch(
    `${BASE}/skills/install`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source }) },
    { ok: true },
  );
}

export async function runResearch(query: string, opts?: { max_iterations?: number; web_search?: boolean }): Promise<AskResponse> {
  return safeFetch(
    `${BASE}/research`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, ...opts }) },
    {
      content: `## RESEARCH INITIATED: ${query}\n\nJARVIS is offline. Connect a backend with API keys to run deep research.\n\n### Status\n- Engine: OFFLINE\n- Reason: No backend connected\n- Action: Configure engine in Settings`,
      tool_results: [],
      model: 'offline',
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

export function streamChat(
  prompt: string,
  agent: string,
  onToken: (t: string) => void,
  onDone: (p: StreamDonePayload) => void,
): () => void {
  const wsBase = window.location.origin.replace(/^http/, 'ws') + '/api';
  let ws: WebSocket | null = null;
  let closed = false;

  const fallback = () => {
    if (closed) return;
    closed = true;
    const txt = `JARVIS OFFLINE — RUN \`jarvis serve\` OR SET API KEYS\n\nYour query: "${prompt}"\n\nConfigure your engine in the Settings panel.`;
    let i = 0;
    const id = setInterval(() => {
      if (i < txt.length) { onToken(txt[i++]); }
      else { clearInterval(id); onDone({ model: 'offline', latency_ms: 0, tokens: txt.length, cost_usd: 0 }); }
    }, 12);
    return () => clearInterval(id);
  };

  try {
    ws = new WebSocket(`${wsBase}/ws/chat`);
    ws.onopen = () => { if (!closed && ws) ws.send(JSON.stringify({ prompt, agent })); };
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data as string) as Record<string, unknown>;
        if (d.token) onToken(d.token as string);
        if (d.done) { onDone({ model: d.model as string | null, latency_ms: d.latency_ms as number, tokens: d.tokens as number, cost_usd: d.cost_usd as number, energy_wh: d.energy_wh as number }); ws?.close(); }
      } catch { /* ignore */ }
    };
    ws.onerror = () => fallback();
  } catch { fallback(); }

  return () => { closed = true; ws?.close(); };
}
