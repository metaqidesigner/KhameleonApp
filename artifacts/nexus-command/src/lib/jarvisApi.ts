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

export interface JarvisHealth {
  status: 'online' | 'degraded' | 'offline';
  engine: string;
  model: string;
  uptime: number;
}

export interface JarvisConnector {
  id: string;
  name: string;
  connected: boolean;
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
}

const OFFLINE_HEALTH: JarvisHealth = {
  status: 'offline',
  engine: 'none',
  model: '—',
  uptime: 0,
};

const MOCK_AGENTS = [
  'simple', 'orchestrator', 'deep_research',
  'morning_digest', 'code_assistant', 'channel_agent',
  'proactive_agent', 'operative',
];

const MOCK_CONNECTORS: JarvisConnector[] = [
  { id: 'gmail', name: 'Gmail', connected: false },
  { id: 'gcalendar', name: 'Google Calendar', connected: false },
  { id: 'slack', name: 'Slack', connected: false },
  { id: 'notion', name: 'Notion', connected: false },
  { id: 'gdrive', name: 'Google Drive', connected: false },
  { id: 'github', name: 'GitHub', connected: false },
  { id: 'discord', name: 'Discord', connected: false },
  { id: 'telegram', name: 'Telegram', connected: false },
];

const MOCK_SKILLS: JarvisSkill[] = [
  { id: 'arxiv', name: 'ArXiv', description: 'Search academic papers', source: 'hermes:arxiv' },
  { id: 'weather', name: 'Weather', description: 'Real-time weather data', source: 'hermes:weather' },
  { id: 'news', name: 'News Digest', description: 'Summarise top news', source: 'hermes:news' },
];

export async function getHealth(): Promise<JarvisHealth> {
  return safeFetch<JarvisHealth>(`${BASE}/health`, undefined, OFFLINE_HEALTH);
}

export async function getAgents(): Promise<string[]> {
  return safeFetch<string[]>(`${BASE}/agents`, undefined, MOCK_AGENTS);
}

export async function getConnectors(): Promise<JarvisConnector[]> {
  return safeFetch<JarvisConnector[]>(`${BASE}/connectors`, undefined, MOCK_CONNECTORS);
}

export async function getSkills(): Promise<JarvisSkill[]> {
  return safeFetch<JarvisSkill[]>(`${BASE}/skills`, undefined, MOCK_SKILLS);
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
      content: `[Demo mode] You asked: "${prompt}". Connect a Jarvis backend to get real responses.`,
      tool_results: [],
      model: 'demo',
    },
  );
}

export async function searchMemory(q: string): Promise<{ content: string; source: string; score: number }[]> {
  return safeFetch(
    `${BASE}/memory/search?q=${encodeURIComponent(q)}`,
    undefined,
    [
      { content: `Demo memory result for "${q}"`, source: '/demo/path.txt', score: 0.92 },
      { content: 'Another cached fact from your knowledge base.', source: '/demo/notes.md', score: 0.78 },
    ],
  );
}

export async function indexMemoryPath(path: string): Promise<{ ok: boolean }> {
  return safeFetch(
    `${BASE}/memory/index`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    },
    { ok: true },
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

export async function runResearch(query: string): Promise<{ content: string; model: string }> {
  return safeFetch(
    `${BASE}/research`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    },
    {
      content: `## Research: ${query}\n\nThis is demo research output. Connect a Jarvis backend with \`ANTHROPIC_API_KEY\` or \`OPENAI_API_KEY\` to run real deep-research queries.\n\n### Key findings\n- Your query was received.\n- No live backend is connected.\n- Install Ollama or set an API key to proceed.`,
      model: 'demo',
    },
  );
}

type WsCleanup = () => void;

export function streamChat(
  prompt: string,
  agent: string,
  onToken: (token: string) => void,
  onDone: (model: string | null) => void,
): WsCleanup {
  const wsBase = BASE.replace(/^http/, 'ws').replace(/^\/api/, `${window.location.origin.replace(/^http/, 'ws')}/api`);

  let ws: WebSocket | null = null;
  let closed = false;

  try {
    ws = new WebSocket(`${wsBase}/ws/chat`);

    ws.onopen = () => {
      if (!closed && ws) ws.send(JSON.stringify({ prompt, agent }));
    };

    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data as string);
        if (d.token) onToken(d.token as string);
        if (d.done) { onDone((d.model as string) ?? null); ws?.close(); }
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      if (!closed) {
        const demoResponse = `[Demo mode] You asked: "${prompt}"\n\nConnect a Jarvis backend to stream real AI responses. Set OPENAI_API_KEY or ANTHROPIC_API_KEY and restart.`;
        let i = 0;
        const interval = setInterval(() => {
          if (i < demoResponse.length) {
            onToken(demoResponse[i++]);
          } else {
            clearInterval(interval);
            onDone('demo');
          }
        }, 18);
        closed = true;
      }
    };

    ws.onclose = () => { /* handled by onDone */ };
  } catch {
    const demoResponse = `[Demo mode] "${prompt}" — no backend connected.`;
    let i = 0;
    const interval = setInterval(() => {
      if (i < demoResponse.length) onToken(demoResponse[i++]);
      else { clearInterval(interval); onDone('demo'); }
    }, 18);
    return () => clearInterval(interval);
  }

  return () => {
    closed = true;
    ws?.close();
  };
}
