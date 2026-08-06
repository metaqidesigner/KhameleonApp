import type { AgentConfig } from './types.js';

export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id:           'claude',
    name:         'CLAUDE',
    provider:     'anthropic',
    model:        'claude-sonnet-4-6',
    enabled:      true,
    role:         'general',
    systemPrompt: `You are Claude, the Khameleon orchestrator agent. You have access to tools that let you read and write files, run builds, check git status, inspect workflow logs, and run approved shell commands — all within the Khameleon workspace.

When the user asks you to make a code change, check a file, run a build, or inspect the workspace, use your tools proactively. Always read the relevant files before editing them. After writing a file, confirm what changed. If a build fails, read the error output and suggest a fix.

Be concise and direct. Prefer action over explanation when the intent is clear.`,
    color:        '#c9a84c',
    initials:     'CL',
    useTools:     true,
  },
  {
    id:           'gpt4o',
    name:         'GPT-4o',
    provider:     'openai',
    model:        'gpt-4o',
    enabled:      true,
    role:         'general',
    systemPrompt: 'You are GPT-4o, a highly capable AI assistant by OpenAI. Be concise and accurate.',
    color:        '#00d4ff',
    initials:     'GP',
  },
  {
    id:           'gemini',
    name:         'GEMINI',
    provider:     'google',
    model:        'gemini-2.0-flash',
    enabled:      true,
    role:         'research',
    systemPrompt: 'You are Gemini, an AI assistant by Google. Focus on research and factual accuracy.',
    color:        '#3fb950',
    initials:     'GM',
  },
  {
    id:           'openrouter',
    name:         'OPENROUTER',
    provider:     'openrouter',
    model:        'mistralai/mistral-7b-instruct',
    enabled:      true,
    role:         'general',
    systemPrompt: 'You are a helpful AI assistant accessible via OpenRouter.',
    color:        '#a78bfa',
    initials:     'OR',
  },
  {
    id:           'local',
    name:         'LOCAL',
    provider:     'ollama',
    model:        'llama3.2',
    enabled:      true,
    role:         'code',
    systemPrompt: 'You are a local AI assistant running via Ollama. Be helpful and efficient.',
    color:        '#f97316',
    initials:     'LC',
  },
  {
    id:           'minimax',
    name:         'MINIMAX',
    provider:     'minimax',
    model:        'abab6.5s-chat',
    enabled:      true,
    role:         'creative',
    systemPrompt: 'You are a creative AI assistant by MiniMax. Focus on imaginative and engaging responses.',
    color:        '#ec4899',
    initials:     'MM',
  },
];

let customAgents: AgentConfig[] = [];

export function getRoster(): AgentConfig[] {
  const envConfig = process.env.AGENTS_CONFIG;
  if (envConfig) {
    try { return JSON.parse(envConfig) as AgentConfig[]; } catch { /* fall through */ }
  }
  return [...DEFAULT_AGENTS, ...customAgents];
}

export function upsertAgent(agent: AgentConfig): void {
  const idx = customAgents.findIndex(a => a.id === agent.id);
  if (idx >= 0) customAgents[idx] = agent;
  else customAgents.push(agent);
}

export function removeAgent(id: string): boolean {
  const len = customAgents.length;
  customAgents = customAgents.filter(a => a.id !== id);
  return customAgents.length < len;
}

export function findAgent(id: string): AgentConfig | undefined {
  return getRoster().find(a => a.id === id);
}
