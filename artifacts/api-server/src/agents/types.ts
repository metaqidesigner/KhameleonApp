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
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
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
