import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AgentType =
  | 'simple' | 'orchestrator' | 'deep_research'
  | 'morning_digest' | 'code_assistant'
  | 'channel_agent' | 'proactive_agent' | 'operative';

export type TabId =
  | 'overview' | 'agents' | 'research' | 'memory'
  | 'comms' | 'analytics' | 'security' | 'vault'
  | 'skills' | 'settings';

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

export interface AgentEvent {
  id: string;
  prompt: string;
  response: string;
  model: string;
  agent: string;
  ts: number;
  durationMs?: number;
  tokens?: number;
  costUsd?: number;
}

export interface PanelLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
}

interface JarvisStore {
  activeTab: TabId;
  chatOpen: boolean;
  chatMessages: ChatMessage[];
  isStreaming: boolean;
  selectedAgent: AgentType;
  agentHistory: AgentEvent[];
  panelLayouts: Record<string, PanelLayout[]>;
  commandPaletteOpen: boolean;
  scanLinesEnabled: boolean;
  cornerBracketsEnabled: boolean;
  tickerSpeed: number;

  setActiveTab: (t: TabId) => void;
  setChatOpen: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  setSelectedAgent: (a: AgentType) => void;
  appendMessage: (msg: ChatMessage) => void;
  updateLastMessage: (patch: Partial<ChatMessage>) => void;
  clearChat: () => void;
  pushAgentEvent: (e: AgentEvent) => void;
  setPanelLayout: (tab: string, layout: PanelLayout[]) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setScanLines: (v: boolean) => void;
  setCornerBrackets: (v: boolean) => void;
  setTickerSpeed: (v: number) => void;
}

export const useJarvisStore = create<JarvisStore>()(
  persist(
    (set) => ({
      activeTab: 'overview',
      chatOpen: false,
      chatMessages: [],
      isStreaming: false,
      selectedAgent: 'simple',
      agentHistory: [],
      panelLayouts: {},
      commandPaletteOpen: false,
      scanLinesEnabled: true,
      cornerBracketsEnabled: true,
      tickerSpeed: 60,

      setActiveTab:          (t)      => set({ activeTab: t }),
      setChatOpen:           (v)      => set({ chatOpen: v }),
      setStreaming:          (v)      => set({ isStreaming: v }),
      setSelectedAgent:      (a)      => set({ selectedAgent: a }),
      appendMessage:         (msg)    => set(s => ({ chatMessages: [...s.chatMessages, msg] })),
      updateLastMessage:     (patch)  => set(s => {
        const msgs = [...s.chatMessages];
        const last = msgs[msgs.length - 1];
        if (last) msgs[msgs.length - 1] = { ...last, ...patch };
        return { chatMessages: msgs };
      }),
      clearChat:             ()       => set({ chatMessages: [] }),
      pushAgentEvent:        (e)      => set(s => ({ agentHistory: [e, ...s.agentHistory].slice(0, 50) })),
      setPanelLayout:        (tab, l) => set(s => ({ panelLayouts: { ...s.panelLayouts, [tab]: l } })),
      setCommandPaletteOpen: (v)      => set({ commandPaletteOpen: v }),
      setScanLines:          (v)      => set({ scanLinesEnabled: v }),
      setCornerBrackets:     (v)      => set({ cornerBracketsEnabled: v }),
      setTickerSpeed:        (v)      => set({ tickerSpeed: v }),
    }),
    {
      name: 'jarvis-ui',
      partialize: (s) => ({
        activeTab: s.activeTab,
        panelLayouts: s.panelLayouts,
        scanLinesEnabled: s.scanLinesEnabled,
        cornerBracketsEnabled: s.cornerBracketsEnabled,
        tickerSpeed: s.tickerSpeed,
        selectedAgent: s.selectedAgent,
      }),
    }
  )
);
