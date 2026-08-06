export type Provider =
  | 'anthropic'
  | 'openai'
  | 'google'
  | 'openrouter'
  | 'ollama'
  | 'minimax'
  | 'custom';

export type AgentStatus = 'online' | 'standby' | 'offline' | 'busy';
export type AgentRole = 'general' | 'research' | 'code' | 'analysis' | 'creative';

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
  /** If true, the agent receives the full Replit tool set (Anthropic only). */
  useTools?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** One tool call + its result, collected during an agentic loop turn. */
export interface ToolCallRecord {
  name: string;
  input: Record<string, unknown>;
  result: string;
  durationMs: number;
  error?: string;
}

/** Emitted as SSE events during an agentic loop so the UI can show live activity. */
export interface ToolEvent {
  type: 'tool_start' | 'tool_result' | 'tool_error';
  name: string;
  input?: Record<string, unknown>;
  result?: string;
  error?: string;
  durationMs?: number;
}

export interface AgentResponse {
  agentId: string;
  content: string;
  model: string;
  latencyMs: number;
  tokens: number;
  costUsd: number;
  energyWh: number;
  error?: string;
  /** Tool calls executed during this response (populated for orchestrator agents). */
  toolCalls?: ToolCallRecord[];
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
  toolCalls?: ToolCallRecord[];
}
