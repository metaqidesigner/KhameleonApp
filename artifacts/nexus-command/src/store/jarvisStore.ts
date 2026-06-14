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

export type OrbStatus = 'online' | 'speaking' | 'listening' | 'offline';

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

export interface VoiceSettings {
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
  lang: string;
  pushToTalk: boolean;
  autoSendDelay: number;
  maxSpeakLength: number;
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

  orbStatus: OrbStatus;
  orbPosition: { x: number; y: number } | null;
  orbMinimized: boolean;
  orbChatOpen: boolean;
  orbActiveAgentId: string;
  voiceEnabled: boolean;
  autoSpeak: boolean;
  wakeWordActive: boolean;
  wakeWordBlocked: boolean;
  pendingVoiceQuery: string | null;
  voiceSettings: VoiceSettings;

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

  setOrbStatus: (s: OrbStatus) => void;
  setOrbPosition: (p: { x: number; y: number }) => void;
  setOrbMinimized: (v: boolean) => void;
  toggleOrbChat: () => void;
  setOrbChatOpen: (v: boolean) => void;
  openOrbChat: () => void;
  setOrbActiveAgentId: (id: string) => void;
  toggleVoice: () => void;
  toggleAutoSpeak: () => void;
  setWakeWordActive: (v: boolean) => void;
  setWakeWordBlocked: (v: boolean) => void;
  setPendingVoiceQuery: (q: string | null) => void;
  setVoiceSettings: (s: Partial<VoiceSettings>) => void;
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

      orbStatus: 'online',
      orbPosition: null,
      orbMinimized: false,
      orbChatOpen: false,
      orbActiveAgentId: 'claude',
      voiceEnabled: true,
      autoSpeak: true,
      wakeWordActive: true,
      wakeWordBlocked: false,
      pendingVoiceQuery: null,
      voiceSettings: {
        voice: '',
        rate: 1.05,
        pitch: 0.9,
        volume: 1.0,
        lang: 'en-US',
        pushToTalk: false,
        autoSendDelay: 800,
        maxSpeakLength: 800,
      },

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

      setOrbStatus:          (s)      => set({ orbStatus: s }),
      setOrbPosition:        (p)      => set({ orbPosition: p }),
      setOrbMinimized:       (v)      => set({ orbMinimized: v }),
      toggleOrbChat:         ()       => set(s => ({ orbChatOpen: !s.orbChatOpen })),
      setOrbChatOpen:        (v)      => set({ orbChatOpen: v }),
      openOrbChat:           ()       => set({ orbChatOpen: true }),
      setOrbActiveAgentId:   (id)     => set({ orbActiveAgentId: id }),
      toggleVoice:           ()       => set(s => ({ voiceEnabled: !s.voiceEnabled })),
      toggleAutoSpeak:       ()       => set(s => ({ autoSpeak: !s.autoSpeak })),
      setWakeWordActive:     (v)      => set({ wakeWordActive: v }),
      setWakeWordBlocked:    (v)      => set({ wakeWordBlocked: v }),
      setPendingVoiceQuery:  (q)      => set({ pendingVoiceQuery: q }),
      setVoiceSettings:      (patch)  => set(s => ({ voiceSettings: { ...s.voiceSettings, ...patch } })),
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
        orbPosition: s.orbPosition,
        orbMinimized: s.orbMinimized,
        orbActiveAgentId: s.orbActiveAgentId,
        voiceEnabled: s.voiceEnabled,
        autoSpeak: s.autoSpeak,
        voiceSettings: s.voiceSettings,
      }),
    }
  )
);
