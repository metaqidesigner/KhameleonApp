import { create } from 'zustand';

export type AgentType =
  | 'simple'
  | 'orchestrator'
  | 'deep_research'
  | 'morning_digest'
  | 'code_assistant'
  | 'channel_agent'
  | 'proactive_agent'
  | 'operative';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agentType?: AgentType;
  timestamp: number;
  model?: string;
  latencyMs?: number;
  tokens?: number;
  costUsd?: number;
  energyWh?: number;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  agentType: AgentType;
  createdAt: number;
}

export interface AgentEvent {
  id: string;
  prompt: string;
  response: string;
  model: string;
  agent: string;
  ts: number;
  durationMs?: number;
}

export type ModuleId =
  | 'dashboard' | 'chat' | 'inbox' | 'projects' | 'approvals' | 'calendar'
  | 'research' | 'memory' | 'knowledge' | 'analytics'
  | 'automations' | 'agents' | 'skills' | 'security' | 'vault'
  | 'communications' | 'marketplace' | 'settings';

interface JarvisStore {
  activeModule: ModuleId;
  railExpanded: boolean;
  commandPaletteOpen: boolean;
  isStreaming: boolean;
  selectedAgent: AgentType;
  chatSessions: ChatSession[];
  activeSessionId: string;
  agentHistory: AgentEvent[];

  setActiveModule: (m: ModuleId) => void;
  setRailExpanded: (v: boolean) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  setSelectedAgent: (a: AgentType) => void;
  newSession: (agentType?: AgentType) => string;
  setActiveSession: (id: string) => void;
  appendMessage: (sessionId: string, msg: ChatMessage) => void;
  updateLastMessage: (sessionId: string, patch: Partial<ChatMessage>) => void;
  pushAgentEvent: (e: AgentEvent) => void;
}

const newSession = (agentType: AgentType = 'simple'): ChatSession => ({
  id: crypto.randomUUID(),
  messages: [],
  agentType,
  createdAt: Date.now(),
});

const defaultSession = newSession();

export const useJarvisStore = create<JarvisStore>((set, get) => ({
  activeModule: 'dashboard',
  railExpanded: true,
  commandPaletteOpen: false,
  isStreaming: false,
  selectedAgent: 'simple',
  chatSessions: [defaultSession],
  activeSessionId: defaultSession.id,
  agentHistory: [],

  setActiveModule: (m) => set({ activeModule: m }),
  setRailExpanded: (v) => set({ railExpanded: v }),
  setCommandPaletteOpen: (v) => set({ commandPaletteOpen: v }),
  setStreaming: (v) => set({ isStreaming: v }),
  setSelectedAgent: (a) => set({ selectedAgent: a }),

  newSession: (agentType = 'simple') => {
    const s = newSession(agentType);
    set(st => ({ chatSessions: [...st.chatSessions, s], activeSessionId: s.id }));
    return s.id;
  },

  setActiveSession: (id) => set({ activeSessionId: id }),

  appendMessage: (sessionId, msg) =>
    set(st => ({
      chatSessions: st.chatSessions.map(s =>
        s.id === sessionId ? { ...s, messages: [...s.messages, msg] } : s
      ),
    })),

  updateLastMessage: (sessionId, patch) =>
    set(st => ({
      chatSessions: st.chatSessions.map(s => {
        if (s.id !== sessionId) return s;
        const msgs = [...s.messages];
        const last = msgs[msgs.length - 1];
        if (last) msgs[msgs.length - 1] = { ...last, ...patch };
        return { ...s, messages: msgs };
      }),
    })),

  pushAgentEvent: (e) =>
    set(st => ({ agentHistory: [e, ...st.agentHistory].slice(0, 50) })),
}));
