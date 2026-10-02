import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SharedWindowModel } from '../../../../khameleon-window-agent/src/types';

export type TabId =
  | 'canvas'
  | 'agents' | 'research' | 'memory'
  | 'comms' | 'analytics' | 'security' | 'vault'
  | 'skills' | 'integrations' | 'approvals' | 'settings' | 'tasks' | 'projects'
  | 'calendar' | 'inbox';

// 'thinking' — processing a request, before a response starts (violet).
// 'error'    — a single coral flash on a non-connection failure, then
//              reverts to 'online' (spec §4: "single pulse, not sustained").
// 'muted'    — visual override applied at render time when voice output
//              is disabled, regardless of the underlying status.
export type OrbStatus = 'online' | 'speaking' | 'listening' | 'thinking' | 'researching' | 'error' | 'offline' | 'muted';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  model?: string;
  latencyMs?: number;
  tokens?: number;
  costUsd?: number;
  energyWh?: number;
  taskRunId?: string;
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

export type CanvasWindowZone = 'left' | 'centre' | 'right';

export interface CanvasWindowPosition {
  zone: CanvasWindowZone;
  order: number;
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
  elevenLabsVoiceId: string;
  elevenLabsModelId: string;
}

interface JarvisStore {
  activeTab: TabId;
  chatOpen: boolean;
  /** Persisted minimised state for each named canvas window */
  canvasWindowsMinimized: Record<string, boolean>;
  /** Persisted column and order for each named canvas window */
  canvasWindowsPositions: Record<string, CanvasWindowPosition>;
  /** Canonical shared window records used by React and native hosts. */
  canvasWindowModels: Record<string, SharedWindowModel>;
  chatMessages: ChatMessage[];
  isStreaming: boolean;
  agentHistory: AgentEvent[];
  panelLayouts: Record<string, PanelLayout[]>;
  commandPaletteOpen: boolean;
  scanLinesEnabled: boolean;
  cornerBracketsEnabled: boolean;
  tickerSpeed: number;

  /** IDs of currently active (running) task runs — drives the badge on the TASKS tab */
  activeTaskIds: string[];
  /** Incremented after a task mutation so other surfaces can refresh their task data. */
  taskRevision: number;

  orbStatus: OrbStatus;
  orbPosition: { x: number; y: number } | null;
  orbMinimized: boolean;
  orbChatOpen: boolean;
  /** Count of currently-mounted AssistantCard instances (its own embedded
      orb+chat - the Assistant tab's hero, Workspace's compact panel). The
      persistent floating orb (JarvisOrbPortal) hides itself while this is
      >0, so there is never more than one orb on screen at once. A count
      rather than a boolean survives two instances briefly overlapping
      (e.g. a tab-switch transition) without one's unmount hiding the
      other's still-mounted orb. */
  embeddedOrbMountCount: number;
  orbActiveAgentId: string;
  voiceEnabled: boolean;
  autoSpeak: boolean;
  wakeWordActive: boolean;
  wakeWordBlocked: boolean;
  pendingVoiceQuery: string | null;
  voiceSettings: VoiceSettings;
  // Controls MicPermissionModal (rendered by VoiceController, which mounts
  // once in AppShell) - lives in the store rather than local component
  // state so Settings' Voice section, a completely different part of the
  // tree, can reopen it after a user skips the first-run prompt.
  micPermissionModalOpen: boolean;
  // Same shape as micPermissionModalOpen - controls OnboardingWizard
  // (mounted once in AppShell, checked at boot against the server-tracked
  // completion flag), reopenable from Settings' "Redo setup" button.
  onboardingWizardOpen: boolean;

  // Chat Window (2026-10-02) - persisted per the same convention as the
  // canvas windows above (jarvisStore, not a new store). Position/size are
  // only meaningful while floating; docked ignores them and uses the
  // right-rail's own layout.
  chatWindowBounds: { x: number; y: number; width: number; height: number };
  chatWindowDocked: boolean;
  chatWindowMinimized: boolean;
  chatReasoningDefault: boolean;
  chatRouteMode: 'single' | 'parallel' | 'vote' | 'council';
  chatLastDomainId: number | 'all';
  chatLastThreadId: string | null;

  setActiveTab: (t: TabId) => void;
  setChatOpen: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  appendMessage: (msg: ChatMessage) => void;
  updateLastMessage: (patch: Partial<ChatMessage>) => void;
  clearChat: () => void;
  pushAgentEvent: (e: AgentEvent) => void;
  setPanelLayout: (tab: string, layout: PanelLayout[]) => void;
  setCommandPaletteOpen: (v: boolean) => void;
  setScanLines: (v: boolean) => void;
  setCornerBrackets: (v: boolean) => void;
  setTickerSpeed: (v: number) => void;
  setCanvasWindowMinimized: (id: string, v: boolean) => void;
  registerCanvasWindow: (model: SharedWindowModel) => void;
  updateCanvasWindow: (id: string, patch: Partial<SharedWindowModel>) => void;
  setCanvasWindowFocused: (id: string, focused: boolean) => void;
  resetCanvasLayout: () => void;
  setCanvasWindowPositions: (positions: Record<string, CanvasWindowPosition>) => void;

  addActiveTask: (id: string) => void;
  removeActiveTask: (id: string) => void;
  notifyTasksChanged: () => void;

  setOrbStatus: (s: OrbStatus) => void;
  setOrbPosition: (p: { x: number; y: number }) => void;
  setOrbMinimized: (v: boolean) => void;
  adjustEmbeddedOrbMountCount: (delta: 1 | -1) => void;
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
  setMicPermissionModalOpen: (v: boolean) => void;
  setOnboardingWizardOpen: (v: boolean) => void;

  setChatWindowBounds: (b: { x: number; y: number; width: number; height: number }) => void;
  setChatWindowDocked: (v: boolean) => void;
  setChatWindowMinimized: (v: boolean) => void;
  setChatReasoningDefault: (v: boolean) => void;
  setChatRouteMode: (m: 'single' | 'parallel' | 'vote' | 'council') => void;
  setChatLastDomainId: (id: number | 'all') => void;
  setChatLastThreadId: (id: string | null) => void;
}

export const useJarvisStore = create<JarvisStore>()(
  persist(
    (set) => ({
      activeTab: 'canvas',
      canvasWindowsMinimized: {},
      canvasWindowsPositions: {},
      canvasWindowModels: {},
      chatOpen: false,
      chatMessages: [],
      isStreaming: false,
      agentHistory: [],
      panelLayouts: {},
      commandPaletteOpen: false,
      scanLinesEnabled: true,
      cornerBracketsEnabled: true,
      tickerSpeed: 60,
      activeTaskIds: [],
      taskRevision: 0,

      orbStatus: 'online',
      orbPosition: null,
      orbMinimized: false,
      orbChatOpen: false,
      embeddedOrbMountCount: 0,
      orbActiveAgentId: 'claude',
      voiceEnabled: true,
      autoSpeak: true,
      wakeWordActive: true,
      wakeWordBlocked: false,
      pendingVoiceQuery: null,
      micPermissionModalOpen: false,
      onboardingWizardOpen: false,

      chatWindowBounds: { x: 0, y: 0, width: 400, height: 600 },
      chatWindowDocked: false,
      chatWindowMinimized: false,
      chatReasoningDefault: false,
      chatRouteMode: 'single',
      chatLastDomainId: 'all',
      chatLastThreadId: null,
      voiceSettings: {
        voice: '',
        rate: 1.05,
        pitch: 0.9,
        volume: 1.0,
        lang: 'en-US',
        pushToTalk: false,
        autoSendDelay: 800,
        maxSpeakLength: 800,
        elevenLabsVoiceId: 'wDsJlOXPqcvIUKdLXjDs',
        elevenLabsModelId: 'eleven_turbo_v2_5',
      },

      setActiveTab:          (t)      => set({ activeTab: t }),
      setChatOpen:           (v)      => set({ chatOpen: v }),
      setStreaming:          (v)      => set({ isStreaming: v }),
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
      setCanvasWindowMinimized: (id, v) => set(s => ({
        canvasWindowsMinimized: { ...s.canvasWindowsMinimized, [id]: v },
        canvasWindowModels: s.canvasWindowModels[id]
          ? {
              ...s.canvasWindowModels,
              [id]: {
                ...s.canvasWindowModels[id],
                presentation: v ? 'minimized' : 'normal',
                restoreBounds: v
                  ? s.canvasWindowModels[id].bounds
                  : s.canvasWindowModels[id].restoreBounds,
                updatedAt: new Date().toISOString(),
              },
            }
          : s.canvasWindowModels,
      })),
      registerCanvasWindow: (model) => set(s => ({
        canvasWindowModels: {
          ...s.canvasWindowModels,
          [model.id]: s.canvasWindowModels[model.id] ?? model,
        },
      })),
      updateCanvasWindow: (id, patch) => set(s => ({
        canvasWindowModels: s.canvasWindowModels[id]
          ? { ...s.canvasWindowModels, [id]: { ...s.canvasWindowModels[id], ...patch, updatedAt: new Date().toISOString() } }
          : s.canvasWindowModels,
      })),
      setCanvasWindowFocused: (id, focused) => set(s => ({
        canvasWindowModels: s.canvasWindowModels[id]
          ? { ...s.canvasWindowModels, [id]: { ...s.canvasWindowModels[id], focused, updatedAt: new Date().toISOString() } }
          : s.canvasWindowModels,
      })),
      resetCanvasLayout: () => set({
        canvasWindowsMinimized: {},
        canvasWindowsPositions: {},
        canvasWindowModels: {},
      }),
      setCanvasWindowPositions: (positions) => set(s => {
        const zoneMap: Record<CanvasWindowZone, SharedWindowModel['zone']> = {
          left: 'side', centre: 'center', right: 'right-rail',
        };
        const canvasWindowModels = { ...s.canvasWindowModels };
        Object.entries(positions).forEach(([id, position]) => {
          const model = canvasWindowModels[id];
          if (model) canvasWindowModels[id] = {
            ...model,
            zone: zoneMap[position.zone],
            zIndex: position.order,
            updatedAt: new Date().toISOString(),
          };
        });
        return { canvasWindowsPositions: positions, canvasWindowModels };
      }),

      addActiveTask:    (id) => set(s => ({ activeTaskIds: [...new Set([...s.activeTaskIds, id])] })),
      removeActiveTask: (id) => set(s => ({ activeTaskIds: s.activeTaskIds.filter(x => x !== id) })),
      notifyTasksChanged: () => set(s => ({ taskRevision: s.taskRevision + 1 })),

      setOrbStatus:          (s)      => set({ orbStatus: s }),
      setOrbPosition:        (p)      => set({ orbPosition: p }),
      setOrbMinimized:       (v)      => set({ orbMinimized: v }),
      adjustEmbeddedOrbMountCount: (delta) => set(s => ({ embeddedOrbMountCount: Math.max(0, s.embeddedOrbMountCount + delta) })),
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
      setMicPermissionModalOpen: (v)  => set({ micPermissionModalOpen: v }),
      setOnboardingWizardOpen:   (v)  => set({ onboardingWizardOpen: v }),

      setChatWindowBounds:       (b)  => set({ chatWindowBounds: b }),
      setChatWindowDocked:       (v)  => set({ chatWindowDocked: v }),
      setChatWindowMinimized:    (v)  => set({ chatWindowMinimized: v }),
      setChatReasoningDefault:   (v)  => set({ chatReasoningDefault: v }),
      setChatRouteMode:          (m)  => set({ chatRouteMode: m }),
      setChatLastDomainId:       (id) => set({ chatLastDomainId: id }),
      setChatLastThreadId:       (id) => set({ chatLastThreadId: id }),
    }),
    {
      name: 'jarvis-ui',
      partialize: (s) => ({
        activeTab: s.activeTab,
        canvasWindowsMinimized: s.canvasWindowsMinimized,
        canvasWindowsPositions: s.canvasWindowsPositions,
        canvasWindowModels: s.canvasWindowModels,
        panelLayouts: s.panelLayouts,
        scanLinesEnabled: s.scanLinesEnabled,
        cornerBracketsEnabled: s.cornerBracketsEnabled,
        tickerSpeed: s.tickerSpeed,
        orbPosition: s.orbPosition,
        orbMinimized: s.orbMinimized,
        orbActiveAgentId: s.orbActiveAgentId,
        voiceEnabled: s.voiceEnabled,
        autoSpeak: s.autoSpeak,
        voiceSettings: s.voiceSettings,
        chatWindowBounds: s.chatWindowBounds,
        chatWindowDocked: s.chatWindowDocked,
        chatWindowMinimized: s.chatWindowMinimized,
        chatReasoningDefault: s.chatReasoningDefault,
        chatRouteMode: s.chatRouteMode,
        chatLastDomainId: s.chatLastDomainId,
        chatLastThreadId: s.chatLastThreadId,
      }),
    }
  )
);
