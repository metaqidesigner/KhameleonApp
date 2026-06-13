import { create } from 'zustand';

export interface AgentEvent {
  id: string;
  prompt: string;
  response: string;
  model: string;
  agent: string;
  ts: number;
  durationMs?: number;
}

interface NexusStore {
  activeModule: string | null;
  panelOpen: boolean;
  isStreaming: boolean;
  agentHistory: AgentEvent[];
  connectedCount: number;
  setActiveModule: (id: string | null) => void;
  setPanelOpen: (open: boolean) => void;
  setStreaming: (v: boolean) => void;
  pushAgentEvent: (e: AgentEvent) => void;
  setConnectedCount: (n: number) => void;
}

export const useNexusStore = create<NexusStore>((set) => ({
  activeModule: null,
  panelOpen: false,
  isStreaming: false,
  agentHistory: [],
  connectedCount: 0,
  setActiveModule: (id) => set({ activeModule: id }),
  setPanelOpen: (open) => set({ panelOpen: open }),
  setStreaming: (v) => set({ isStreaming: v }),
  pushAgentEvent: (e) =>
    set((s) => ({ agentHistory: [e, ...s.agentHistory].slice(0, 20) })),
  setConnectedCount: (n) => set({ connectedCount: n }),
}));
