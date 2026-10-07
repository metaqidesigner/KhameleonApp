import { useJarvisStore } from '@/store/jarvisStore';

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

export interface MemoryItem {
  id: number;
  category: string;
  key: string;
  value: string;
  isProtected: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getMemoryItems(): Promise<MemoryItem[]> {
  return safeFetch<MemoryItem[]>(`${BASE}/memory`, undefined, []);
}

export interface MemorySearchResult {
  content: string;
  source: string;
  score: number;
  chunk_id?: string;
  ts?: string;
}

/** Falls back to an empty result set on failure, never fabricated matches — a real search returning nothing looks the same as a backend that's unreachable, which is the honest behavior. */
export async function searchMemory(q: string): Promise<MemorySearchResult[]> {
  return safeFetch<MemorySearchResult[]>(`${BASE}/memory/search?q=${encodeURIComponent(q)}`, undefined, []);
}

/** Throws on failure rather than reporting a fake success — indexing is a mutation with a real, checkable outcome, not a value that's safe to paper over. */
export async function indexMemoryPath(path: string): Promise<{ ok: boolean; chunks?: number }> {
  const res = await fetch(`${BASE}/memory/index`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? `Failed to index path (HTTP ${res.status})`);
  }
  return res.json();
}

// Skill Sets moved to lib/skillSetsApi.ts (design-spec.md §15) — this
// old getSkills()/installSkill() pair modeled a much simpler "install a
// named skill by string" concept with no backend behind it at all.

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

// ── Task taxonomy types ────────────────────────────────────
export type TaskCategory   = 'communication' | 'meetings' | 'deep_work' | 'task_project_management' | 'administrative' | 'planning';
export type TaskPriority   = 'urgent' | 'high' | 'medium' | 'low';
export type TaskRecurrence = 'one_off' | 'daily' | 'weekly' | 'custom';
export type TaskStatus     = 'todo' | 'in_progress' | 'done' | 'blocked' | 'needs_input';
export type TaskSource     = 'manual' | 'agent';

export interface Task {
  id:               number;
  title:            string;
  description:      string;
  status:           TaskStatus;
  priority:         TaskPriority;
  category:         TaskCategory;
  recurrence:       TaskRecurrence;
  source:           TaskSource;
  calendarEventId?: string | null;
  threadId?:        string | null;
  parentTaskId?:    number | null;
  projectId?:       number | null;
  projectName?:     string | null;
  assignee:         string;
  dueDate?:         string | null;
  aiRecommendation: string;
  createdAt:        string;
  updatedAt:        string;
  /** Live Wall left column (2026-09-25) - why a parked task isn't progressing on its own. null for anything not parked for a specific tracked reason. */
  parkedReason?:    'external_input' | 'deferred' | 'dependency' | null;
  /** What/who it's waiting on, e.g. "tenant reply" - required context for parkedReason to be useful, not just "paused". */
  waitingOn?:       string | null;
  waitingSince?:    string | null;
  /** parkedReason 'dependency' only: which other task this is waiting on to finish first. */
  blockedByTaskId?: number | null;
  /** design-spec.md §15.2 - a not-yet-installed Skill Set closely matching this task, or null. */
  skillSetSuggestion?: { skillSetId: number; name: string; reason: string } | null;
  /** Center column "current focus" (2026-09-26) - AgentConfig.id of whichever agent is/was working this, if known. */
  executingAgentId?: string | null;
  /** Whether this task's execution used a zero-data-retention endpoint. */
  zdrEndpoint?:      boolean | null;
  /** User-directed queue order (drag-to-reorder); null = unordered. */
  queuePosition?:    number | null;
}

export interface CreateTaskInput {
  title:            string;
  description?:     string;
  status?:          TaskStatus;
  priority?:        TaskPriority;
  category?:        TaskCategory;
  recurrence?:      TaskRecurrence;
  calendarEventId?: string | null;
  threadId?:        string | null;
  parentTaskId?:    number | null;
  projectId?:       number | null;
  dueDate?:         string | null;
  aiRecommendation?: string;
}

export interface UpdateTaskInput {
  title?:           string;
  description?:     string;
  status?:          TaskStatus;
  priority?:        TaskPriority;
  category?:        TaskCategory;
  recurrence?:      TaskRecurrence;
  dueDate?:         string | null;
  parentTaskId?:    number | null;
  parkedReason?:    'external_input' | 'deferred' | 'dependency' | null;
  waitingOn?:       string | null;
  waitingSince?:    string | null;
  blockedByTaskId?: number | null;
  executingAgentId?: string | null;
  zdrEndpoint?:      boolean | null;
  queuePosition?:    number | null;
  aiRecommendation?: string;
}

export interface DailyTasksResponse {
  sections:  Record<string, Task[]>;
  total:     number;
  doneCount: number;
  byCategory: Record<string, number>;
}

export async function getTasks(params?: Partial<{
  category:   string;
  priority:   string;
  recurrence: string;
  source:     string;
  status:     string;
  q:          string;
}>): Promise<Task[]> {
  const filtered = Object.entries(params ?? {}).filter(([, v]) => v != null && v !== '');
  const qs = filtered.length ? '?' + new URLSearchParams(Object.fromEntries(filtered)).toString() : '';
  return safeFetch<Task[]>(`${BASE}/tasks${qs}`, undefined, []);
}

export async function getDailyTasks(): Promise<DailyTasksResponse> {
  return safeFetch<DailyTasksResponse>(
    `${BASE}/tasks/daily`,
    undefined,
    { sections: { start_of_day: [], core_work: [], meetings: [], communication: [], administrative: [], end_of_day: [] }, total: 0, doneCount: 0, byCategory: {} },
  );
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const res = await fetch(`${BASE}/tasks`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ priority: 'medium', category: 'deep_work', recurrence: 'one_off', ...input }),
  });
  if (!res.ok) throw new Error('Failed to create task');
  const task = await res.json() as Task;
  useJarvisStore.getState().notifyTasksChanged();
  return task;
}

export async function updateTask(id: number, input: UpdateTaskInput): Promise<Task> {
  const res = await fetch(`${BASE}/tasks/${id}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to update task');
  const task = await res.json() as Task;
  useJarvisStore.getState().notifyTasksChanged();
  return task;
}

export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete task');
  useJarvisStore.getState().notifyTasksChanged();
}

/** §15.2: "does not repeat for the same task thread" - permanent once dismissed. */
export async function dismissSkillSetSuggestion(taskId: number): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${taskId}/skill-set-suggestion/dismiss`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to dismiss suggestion');
  useJarvisStore.getState().notifyTasksChanged();
}

// ── Scheduler ──────────────────────────────────────────────
export interface SchedulerStatus {
  enabled:      boolean;
  digestHour:   number;
  digestMinute: number;
  nextRunAt:    string | null;
  lastRunAt:    string | null;
}

export async function getSchedulerStatus(): Promise<SchedulerStatus> {
  return safeFetch<SchedulerStatus>(
    `${BASE}/scheduler/status`,
    undefined,
    { enabled: true, digestHour: 7, digestMinute: 0, nextRunAt: null, lastRunAt: null },
  );
}

/**
 * Save digest schedule preferences. Used to be impossible from the
 * browser at all - PUT /api/scheduler/config was gated behind a
 * SCHEDULER_ADMIN_KEY that had no default, so the endpoint just 503'd
 * until an operator set env vars on both the server and this bundle.
 * That's now open by default in this single-user app (see the comment
 * on requireAdminKey in routes/scheduler.ts) - no auth header needed
 * here unless SCHEDULER_ADMIN_KEY has been deliberately configured for
 * a hosted/org deployment, which this single-user client doesn't do.
 */
export async function saveSchedulerConfig(patch: Partial<Pick<SchedulerStatus, 'enabled' | 'digestHour' | 'digestMinute'>>): Promise<SchedulerStatus> {
  const res = await fetch(`${BASE}/scheduler/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? `Failed to save digest schedule (HTTP ${res.status})`);
  }
  return res.json();
}

// ── Onboarding: model-provider API keys ─────────────────────
// Unlike OAuth connectors (Google/Microsoft/Spotify — user clicks Connect),
// these providers need the user to actually type a key in. Added 2026-08-27
// so setup doesn't require the server operator to configure env vars.
export type ApiKeyProvider = 'anthropic' | 'openai' | 'google' | 'openrouter' | 'minimax';
export type ApiKeyStatus = Record<string, boolean>;

export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
  return safeFetch<ApiKeyStatus>(`${BASE}/onboarding/api-keys`, undefined, {});
}

export interface Profile {
  displayName: string | null;
  role: string | null;
}

export interface OnboardingStatus {
  apiKeys: ApiKeyStatus;
  oauth: Record<string, boolean>;
  encryptionConfigured: boolean;
  profile: Profile;
  onboardingComplete: boolean;
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  return safeFetch<OnboardingStatus>(`${BASE}/onboarding/status`, undefined, {
    apiKeys: {}, oauth: {}, encryptionConfigured: false,
    profile: { displayName: null, role: null },
    // Fails toward "already set up" rather than "needs onboarding" - a
    // backend hiccup shouldn't pop the first-run wizard in front of an
    // existing user who's long past needing it.
    onboardingComplete: true,
  });
}

/** Mutation - throws on failure, matching every other save in this app. */
export async function saveProfile(patch: Partial<Profile>): Promise<Profile> {
  const res = await fetch(`${BASE}/onboarding/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? 'Failed to save profile');
  }
  return res.json();
}

/** Marks first-run setup finished (or explicitly skipped) - server-tracked, not per-browser. */
export async function completeOnboarding(): Promise<void> {
  const res = await fetch(`${BASE}/onboarding/complete`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? 'Failed to complete onboarding');
  }
}

export async function saveApiKey(provider: ApiKeyProvider, apiKey: string): Promise<void> {
  const res = await fetch(`${BASE}/onboarding/api-key`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, apiKey }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? `Failed to save ${provider} API key`);
  }
}

export async function clearApiKey(provider: ApiKeyProvider): Promise<void> {
  const res = await fetch(`${BASE}/onboarding/api-key/${provider}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to clear ${provider} API key`);
}

// ── Weather default location ─────────────────────────────────
export interface WeatherDefaultLocation {
  lat: number | null;
  lon: number | null;
  label: string | null;
}

export async function getWeatherDefault(): Promise<WeatherDefaultLocation> {
  return safeFetch<WeatherDefaultLocation>(`${BASE}/weather/default`, undefined, { lat: null, lon: null, label: null });
}

export async function saveWeatherDefault(lat: number, lon: number, label?: string): Promise<WeatherDefaultLocation> {
  const res = await fetch(`${BASE}/weather/default`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon, label }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({} as { error?: string }));
    throw new Error(body.error ?? 'Failed to save default weather location');
  }
  return res.json();
}

export interface WeatherCurrent {
  label: string | null;
  lat: number;
  lon: number;
  observedAt: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPct: number;
  precipitationMm: number;
  windSpeedKmh: number;
  conditions: string;
}

/** Current conditions at the saved default location. Returns null if none is set or the fetch fails - a missing widget, not an error banner. */
export async function getWeatherCurrent(): Promise<WeatherCurrent | null> {
  return safeFetch<WeatherCurrent | null>(`${BASE}/weather`, undefined, null);
}

// ── Spotify now playing ──────────────────────────────────────
export interface SpotifyNowPlaying {
  playing: boolean;
  track?: string;
  artists?: string[];
  album?: string;
  albumArt?: string | null;
  progressMs?: number | null;
  durationMs?: number;
  url?: string;
}

/** Returns { playing: false } if nothing is playing, not connected, or the fetch fails - a quiet widget state, not an error. */
export async function getSpotifyNowPlaying(): Promise<SpotifyNowPlaying> {
  return safeFetch<SpotifyNowPlaying>(`${BASE}/spotify/now-playing`, undefined, { playing: false });
}

async function spotifyControl(action: 'play' | 'pause' | 'next' | 'previous'): Promise<void> {
  const res = await fetch(`${BASE}/spotify/${action}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Spotify ${action} failed (HTTP ${res.status})`);
}

export const spotifyPlay     = () => spotifyControl('play');
export const spotifyPause    = () => spotifyControl('pause');
export const spotifyNext     = () => spotifyControl('next');
export const spotifyPrevious = () => spotifyControl('previous');

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
