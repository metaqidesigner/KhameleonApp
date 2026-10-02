import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GripVertical, Mic, Paperclip, Send, X, Minus, PanelRightClose, PanelRightOpen,
  Eye, EyeOff, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Loader2,
} from 'lucide-react';
import { useJarvisStore } from '@/store/jarvisStore';
import { useWindowDrag } from './useWindowDrag';
import { routeSingleStreaming, routeMultiAgent, pickAutoRouteAgent } from './chatWindowApi';
import {
  getRoster, getAgentStatus, FALLBACK_ROSTER,
  type AgentConfig, type AgentStatus as AgentOnlineStatus,
} from '@/lib/agentsApi';
import { getWorkDomains, type WorkDomain } from '@/lib/workDomainsApi';
import { getDailyTasks, getOnboardingStatus, type Task } from '@/lib/jarvisApi';
import { getTaskRun } from '@/lib/taskRunApi';
import type { TaskRun } from '@/lib/taskRunApi';
import { TaskRunCard } from '@/components/taskRun/TaskRunParts';
import { useVoice } from '@/components/orb/useVoice';
import type { AgentRef, ChatMessage, ChatThread, RouteMode, StarterCard } from './types';
import { ROUTE_MODE_LABELS, ROUTE_MODE_DESCRIPTIONS } from './types';

const HEAD_SRC = '/khameleon-head.webp';
const DEFAULT_FLOATING_SIZE = { width: 400, height: 600 };

function newBounds() {
  const width = DEFAULT_FLOATING_SIZE.width;
  const height = DEFAULT_FLOATING_SIZE.height;
  return {
    x: Math.max(24, window.innerWidth - width - 32),
    y: Math.max(24, window.innerHeight - height - 100),
    width,
    height,
  };
}

function fmtCost(n?: number) { return n === undefined ? 'n/a' : `$${n.toFixed(4)}`; }
function fmtEnergy(n?: number) { return n === undefined ? 'n/a' : `${n.toFixed(2)} Wh`; }
function fmtDuration(ms?: number) { return ms === undefined ? 'n/a' : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`; }

function starterCardsForRole(role: string | null, domainName?: string): StarterCard[] {
  const scoped = domainName ? ` in ${domainName}` : '';
  const base: StarterCard[] = [
    { id: 'summarize', label: 'Summarize what changed', prompt: `What changed${scoped} since yesterday?` },
    { id: 'whats-next', label: "What's next", prompt: `What should I focus on next${scoped}?` },
    { id: 'draft', label: 'Draft a reply', prompt: `Draft a reply to the most recent thing waiting on me${scoped}.` },
    { id: 'risks', label: 'Flag risks', prompt: `Anything at risk${scoped} that needs my attention?` },
  ];
  const r = (role ?? '').toLowerCase();
  if (r.includes('sales')) base[0] = { id: 'pipeline', label: 'Review pipeline', prompt: `How is the pipeline looking${scoped}?` };
  if (r.includes('support')) base[0] = { id: 'tickets', label: 'Ticket volume', prompt: `What's ticket volume and resolution time looking like${scoped}?` };
  if (r.includes('product') || r.includes('pm')) base[0] = { id: 'roadmap', label: 'Roadmap check', prompt: `What's moved on the roadmap${scoped}?` };
  return base;
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function HeadAvatar({ size, glow }: { size: number; glow?: boolean }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {glow && (
        <div style={{ position: 'absolute', inset: -size * 0.3, borderRadius: '50%', background: 'radial-gradient(circle, rgba(95,240,216,.22), transparent 65%)', filter: 'blur(4px)', pointerEvents: 'none' }} />
      )}
      <img src={HEAD_SRC} alt="" style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain', transform: 'translate(1%,-6%)', pointerEvents: 'none' }} />
    </div>
  );
}

// ── Message bubble ───────────────────────────────────────────────────────────

function ReasoningBlock({ message }: { message: ChatMessage }) {
  const [open, setOpen] = useState(false);
  if (!message.reasoning || message.reasoning.length === 0) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(183,156,255,0.08)',
          border: '1px solid rgba(183,156,255,0.22)', color: '#b79cff', borderRadius: 7,
          padding: '4px 9px', fontFamily: 'var(--chat-mono)', fontSize: 10, cursor: 'pointer',
        }}
      >
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />} Show reasoning ({message.reasoning.length})
      </button>
      {open && (
        <div style={{ marginTop: 6, padding: '8px 10px', background: 'rgba(183,156,255,0.06)', border: '1px solid rgba(183,156,255,0.16)', borderRadius: 8 }}>
          {message.reasoning.map((step, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 0', borderBottom: i < message.reasoning!.length - 1 ? '1px solid rgba(183,156,255,0.1)' : 'none' }}>
              <span style={{ fontSize: 11, color: '#d6efee' }}>{step.label}</span>
              {step.elapsedMs !== undefined && <span style={{ fontSize: 9, color: '#8fb4b6', fontFamily: 'var(--chat-mono)', flexShrink: 0 }}>{fmtDuration(step.elapsedMs)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MetaLine({ meta }: { meta?: ChatMessage['meta'] }) {
  if (!meta) return null;
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 5, fontFamily: 'var(--chat-mono)', fontSize: 9, color: '#7fa3a6' }}>
      <span>{fmtDuration(meta.durationMs)}</span>
      <span>{fmtCost(meta.costUsd)}</span>
      <span>{fmtEnergy(meta.energyWh)}</span>
      {meta.zeroDataRetention && <span style={{ color: '#4ee0a0' }}>ZDR</span>}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', maxWidth: '90%', flexDirection: isUser ? 'row-reverse' : 'row' }}>
        {!isUser && <HeadAvatar size={26} />}
        <div>
          {!isUser && message.answeredBy && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#d6efee' }}>{message.answeredBy.name}</span>
              {message.routedForReason && <span style={{ fontSize: 9, color: '#7fa3a6' }}>routed for {message.routedForReason}</span>}
            </div>
          )}
          <div style={{
            padding: '9px 13px', borderRadius: 12, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
            color: '#d6efee',
            background: isUser ? 'rgba(95,240,216,0.14)' : 'rgba(255,255,255,0.045)',
            border: `1px solid ${isUser ? 'rgba(95,240,216,0.3)' : 'rgba(255,255,255,0.08)'}`,
          }}>
            {message.content}
          </div>
          <ReasoningBlock message={message} />
          <MetaLine meta={message.meta} />
        </div>
      </div>
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  domains, activeDomainId, onPickDomain, onStarter, parked, wakeWordActive, wakeWordBlocked, role,
}: {
  domains: WorkDomain[];
  activeDomainId: number | 'all';
  onPickDomain: (id: number | 'all') => void;
  onStarter: (prompt: string) => void;
  parked: Task[];
  wakeWordActive: boolean;
  wakeWordBlocked: boolean;
  role: string | null;
}) {
  const activeDomain = domains.find(d => d.id === activeDomainId);
  const starters = useMemo(() => starterCardsForRole(role, activeDomain?.name), [activeDomain, role]);
  const topParked = parked[0];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 18px', gap: 14, overflowY: 'auto' }}>
      <div style={{ width: 96, height: 96, marginBottom: 2 }}>
        <HeadAvatar size={96} glow />
      </div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#d6efee', textAlign: 'center' }}>What are we working on?</h2>
      <p style={{ margin: 0, fontSize: 11, color: '#8fb4b6', display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: wakeWordActive && !wakeWordBlocked ? '#4ee0a0' : '#5a6a6a', animation: wakeWordActive && !wakeWordBlocked ? 'chat-pulse-dot 2s ease-in-out infinite' : 'none' }} />
        {wakeWordBlocked ? 'Wake word unavailable in this browser' : wakeWordActive ? "Listening for 'Hello Khameleon'" : 'Wake word off'}
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 4 }}>
        <button type="button" onClick={() => onPickDomain('all')} className="chat-domain-chip" data-active={activeDomainId === 'all'}>All domains</button>
        {domains.map(d => (
          <button key={d.id} type="button" onClick={() => onPickDomain(d.id)} className="chat-domain-chip" data-active={activeDomainId === d.id}>{d.name}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%', maxWidth: 320, marginTop: 6 }}>
        {starters.map(s => (
          <button key={s.id} type="button" onClick={() => onStarter(s.prompt)} className="chat-starter-card">
            {s.label}
          </button>
        ))}
      </div>

      {topParked && (
        <div style={{ width: '100%', maxWidth: 320, marginTop: 8, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,179,107,0.07)', border: '1px solid rgba(255,179,107,0.22)' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.08em', color: '#ffb36b', textTransform: 'uppercase', marginBottom: 4 }}>Parked</div>
          <div style={{ fontSize: 12, color: '#d6efee', marginBottom: 6 }}>{topParked.title}</div>
          <button type="button" onClick={() => onStarter(`Resume: ${topParked.title}`)} className="chat-resume-btn">Resume</button>
        </div>
      )}
    </div>
  );
}

// ── Agent strip ──────────────────────────────────────────────────────────────

const STATUS_DOT_COLOR: Record<AgentOnlineStatus, string> = {
  online: '#4ee0a0', busy: '#ffb36b', standby: '#ffb36b', offline: '#5a6a6a',
};

function AgentStrip({ roster, statuses, pinnedId, onPin, zdrKnown }: {
  roster: AgentConfig[];
  statuses: Record<string, AgentOnlineStatus>;
  pinnedId: string | null;
  onPin: (id: string | null) => void;
  zdrKnown: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderBottom: '1px solid rgba(95,240,216,0.1)', overflowX: 'auto', flexShrink: 0 }}>
      <button type="button" onClick={() => onPin(null)} className="chat-agent-pill" data-active={pinnedId === null} title="Let Khameleon choose the agent">
        Auto-route
      </button>
      {roster.map(a => (
        <button key={a.id} type="button" onClick={() => onPin(a.id)} className="chat-agent-pill" data-active={pinnedId === a.id} title={`${a.name} - ${statuses[a.id] ?? 'offline'}`}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT_COLOR[statuses[a.id] ?? 'offline'], display: 'inline-block', marginRight: 5 }} />
          {a.name}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      {zdrKnown && <span style={{ fontSize: 9, color: '#4ee0a0', fontFamily: 'var(--chat-mono)', flexShrink: 0, whiteSpace: 'nowrap' }}>ZDR on</span>}
    </div>
  );
}

// ── Composer ─────────────────────────────────────────────────────────────────

function Composer({ onSend, sending, routeMode, onRouteMode, focusSignal }: {
  onSend: (text: string) => void;
  sending: boolean;
  routeMode: RouteMode;
  onRouteMode: (m: RouteMode) => void;
  focusSignal: number;
}) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Cmd/Ctrl+J focuses the composer - see ChatWindow's keydown handler.
  useEffect(() => { if (focusSignal > 0) textareaRef.current?.focus(); }, [focusSignal]);

  const handleTranscript = useCallback((text: string) => { setValue(v => (v ? `${v} ${text}` : text)); }, []);
  const voice = useVoice(handleTranscript);

  const submit = () => {
    const text = value.trim();
    if (!text || sending) return;
    setValue('');
    onSend(text);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter') submit();
  };

  return (
    <div style={{ borderTop: '1px solid rgba(95,240,216,0.1)', padding: '8px 12px 10px', flexShrink: 0 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 7, overflowX: 'auto' }}>
        {(Object.keys(ROUTE_MODE_LABELS) as RouteMode[]).map(m => (
          <button key={m} type="button" onClick={() => onRouteMode(m)} className="chat-route-pill" data-active={routeMode === m}>
            {ROUTE_MODE_LABELS[m]}
          </button>
        ))}
        <span style={{ fontSize: 9, color: '#7fa3a6', alignSelf: 'center', marginLeft: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {ROUTE_MODE_DESCRIPTIONS[routeMode]}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <button type="button" title="Attach a file (not yet wired)" aria-label="Attach a file" className="chat-icon-btn" disabled>
          <Paperclip size={15} />
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask Khameleon anything…"
          aria-label="Message Khameleon"
          rows={1}
          disabled={sending}
          style={{
            flex: 1, resize: 'none', maxHeight: 96, minHeight: 36, padding: '8px 10px', borderRadius: 9,
            background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', color: '#d6efee',
            fontSize: 13, fontFamily: 'var(--chat-ui)', outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={voice.toggleListening}
          title="Voice input"
          aria-label={voice.isListening ? 'Stop voice input' : 'Start voice input'}
          className="chat-icon-btn"
          data-active={voice.isListening}
          disabled={!voice.voiceInputAvailable}
        >
          <Mic size={15} />
        </button>
        <button type="button" onClick={submit} disabled={!value.trim() || sending} aria-label="Send message" className="chat-send-btn">
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
// Space Grotesk / JetBrains Mono, bundled locally (public/fonts) rather than
// linked from Google's CDN at runtime - the spec explicitly requires the
// desktop app not depend on a font CDN. Both are real variable-font files
// (one file covers the whole weight range), downloaded once, not generated.

function ChatWindowStyles() {
  return (
    <style>{`
      @font-face{font-family:'Space Grotesk';font-style:normal;font-weight:400 700;font-display:swap;src:url('/fonts/space-grotesk-variable.woff2') format('woff2')}
      @font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:400 700;font-display:swap;src:url('/fonts/jetbrains-mono-variable.woff2') format('woff2')}
      .chat-window{--chat-ui:'Space Grotesk',var(--j-font-ui,sans-serif);--chat-mono:'JetBrains Mono',var(--j-font-mono,monospace);font-family:var(--chat-ui)}
      .chat-window *{box-sizing:border-box}
      .chat-window button:focus-visible,.chat-window input:focus-visible,.chat-window textarea:focus-visible,.chat-window select:focus-visible,.chat-window [role="button"]:focus-visible{outline:2px solid #5ff0d8;outline-offset:2px}
      .chat-icon-btn{width:40px;height:36px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;border-radius:8px;color:#8fb4b6;cursor:pointer;flex-shrink:0}
      .chat-icon-btn:hover{background:rgba(255,255,255,0.06);color:#d6efee}
      .chat-icon-btn[data-active="true"]{color:#5ff0d8;background:rgba(95,240,216,0.1)}
      .chat-icon-btn:disabled{opacity:0.35;cursor:not-allowed}
      .chat-send-btn{width:36px;height:36px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:9px;border:1px solid rgba(95,240,216,0.4);background:rgba(95,240,216,0.14);color:#5ff0d8;cursor:pointer}
      .chat-send-btn:disabled{opacity:0.35;cursor:not-allowed}
      .chat-chip-select{height:32px;padding:0 8px;border-radius:7px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);color:#d6efee;font-family:var(--chat-mono);font-size:10px;max-width:120px}
      .chat-agent-pill,.chat-route-pill,.chat-domain-chip{height:32px;padding:0 10px;border-radius:999px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#8fb4b6;font-family:var(--chat-mono);font-size:10px;cursor:pointer;white-space:nowrap;flex-shrink:0;display:flex;align-items:center}
      .chat-agent-pill[data-active="true"]{color:#5ff0d8;border-color:rgba(95,240,216,0.4);background:rgba(95,240,216,0.1)}
      .chat-route-pill{height:28px}
      .chat-route-pill[data-active="true"]{color:#ffb36b;border-color:rgba(255,179,107,0.4);background:rgba(255,179,107,0.1)}
      .chat-domain-chip[data-active="true"]{color:#5ff0d8;border-color:rgba(95,240,216,0.4);background:rgba(95,240,216,0.1)}
      .chat-starter-card{padding:10px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#d6efee;font-family:var(--chat-ui);font-size:11px;text-align:left;cursor:pointer;line-height:1.3}
      .chat-starter-card:hover{background:rgba(255,255,255,0.07)}
      .chat-resume-btn{height:28px;padding:0 12px;border-radius:7px;background:rgba(255,179,107,0.12);border:1px solid rgba(255,179,107,0.35);color:#ffb36b;font-family:var(--chat-mono);font-size:10px;cursor:pointer}
      .chat-spin{animation:chat-spin 1s linear infinite}
      @keyframes chat-spin{to{transform:rotate(360deg)}}
      @keyframes chat-pulse-dot{0%,100%{opacity:1}50%{opacity:0.35}}
      .chat-reduced-motion .chat-spin{animation:none}
      .chat-reduced-motion [style*="chat-pulse-dot"]{animation:none}
      @media (prefers-reduced-motion: reduce){.chat-window .chat-spin{animation:none}}
    `}</style>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ChatWindow() {
  const chatOpen = useJarvisStore(s => s.chatOpen);
  const setChatOpen = useJarvisStore(s => s.setChatOpen);
  const bounds = useJarvisStore(s => s.chatWindowBounds);
  const setBounds = useJarvisStore(s => s.setChatWindowBounds);
  const docked = useJarvisStore(s => s.chatWindowDocked);
  const setDocked = useJarvisStore(s => s.setChatWindowDocked);
  const minimized = useJarvisStore(s => s.chatWindowMinimized);
  const setMinimized = useJarvisStore(s => s.setChatWindowMinimized);
  const reasoningDefault = useJarvisStore(s => s.chatReasoningDefault);
  const setReasoningDefault = useJarvisStore(s => s.setChatReasoningDefault);
  const routeMode = useJarvisStore(s => s.chatRouteMode);
  const setRouteMode = useJarvisStore(s => s.setChatRouteMode);
  const lastDomainId = useJarvisStore(s => s.chatLastDomainId);
  const setLastDomainId = useJarvisStore(s => s.setChatLastDomainId);
  const wakeWordActive = useJarvisStore(s => s.wakeWordActive);
  const wakeWordBlocked = useJarvisStore(s => s.wakeWordBlocked);
  const activeTaskIds = useJarvisStore(s => s.activeTaskIds);
  const removeActiveTask = useJarvisStore(s => s.removeActiveTask);
  const taskRevision = useJarvisStore(s => s.taskRevision);

  const [roster, setRoster] = useState<AgentConfig[]>(FALLBACK_ROSTER);
  const [statuses, setStatuses] = useState<Record<string, AgentOnlineStatus>>({});
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [domains, setDomains] = useState<WorkDomain[]>([]);
  const [parked, setParked] = useState<Task[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [activeRuns, setActiveRuns] = useState<TaskRun[]>([]);
  const [focusSignal, setFocusSignal] = useState(0);

  const bodyRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (bounds.width === 400 && bounds.height === 600 && bounds.x === 0 && bounds.y === 0) {
      setBounds(newBounds());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getRoster().then(setRoster).catch(() => {});
    getWorkDomains().then(setDomains).catch(() => {});
    getDailyTasks().then(d => {
      const all = Object.values(d.sections).flat();
      setParked(all.filter(t => t.status === 'blocked' || t.parkedReason != null));
    }).catch(() => {});
    getOnboardingStatus().then(s => setProfileRole(s.profile.role)).catch(() => {});
  }, []);

  useEffect(() => {
    if (roster.length === 0) return;
    Promise.all(roster.map(a => getAgentStatus(a.id).then(s => [a.id, s.status] as const).catch(() => [a.id, 'offline'] as const)))
      .then(entries => setStatuses(Object.fromEntries(entries)));
  }, [roster]);

  // Auto-scroll only when already at (or near) the bottom.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => () => { stopStreamRef.current?.(); }, []);

  // Keyboard shortcuts (2026-10-02, logged in khameleon-decisions-log.md):
  // Cmd/Ctrl+J focuses the composer, Cmd/Ctrl+Shift+D toggles dock/float.
  // Only active while the window is open - doesn't steal keys globally.
  useEffect(() => {
    if (!chatOpen) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setMinimized(false);
        setFocusSignal(s => s + 1);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setDocked(!docked);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [chatOpen, docked, setDocked, setMinimized]);

  // Live Task Card: real TaskRun data via the global activeTaskIds list
  // (jarvisStore) - a task keeps running and stays tracked here whether
  // or not this window is open/minimized, since the ids live in the
  // global store, not this component's own state.
  useEffect(() => {
    if (activeTaskIds.length === 0) { setActiveRuns([]); return; }
    Promise.all(activeTaskIds.map(id => getTaskRun(id))).then(runs => {
      setActiveRuns(runs.filter((r): r is TaskRun => r !== null));
    });
  }, [activeTaskIds, taskRevision]);

  const { bounds: liveBounds, startDrag, startResize, isDragging, isResizing, showRailDropZone } = useWindowDrag(
    bounds,
    (b) => setBounds(b),
    () => setDocked(true),
  );

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    const conversation = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
    const pinnedAgent = roster.find(a => a.id === pinnedId);

    if (routeMode === 'single') {
      const agent = pinnedAgent ?? pickAutoRouteAgent(roster) ?? roster[0];
      const assistantId = crypto.randomUUID();
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: Date.now() }]);
      let accumulated = '';
      stopStreamRef.current = routeSingleStreaming(
        agent.id, conversation,
        (token) => {
          accumulated += token;
          setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, content: accumulated } : m)));
          if (liveRegionRef.current) liveRegionRef.current.textContent = `${agent.name} is responding`;
        },
        (result) => {
          setMessages(prev => prev.map(m => (m.id === assistantId ? {
            ...m,
            answeredBy: { id: agent.id, name: agent.name, status: statuses[agent.id] ?? 'offline', color: agent.color, initials: agent.initials },
            routedForReason: result.routedForReason,
            reasoning: result.reasoning,
            meta: { durationMs: result.durationMs, costUsd: result.costUsd, energyWh: result.energyWh },
          } : m)));
          if (liveRegionRef.current) liveRegionRef.current.textContent = `${agent.name} replied`;
          setSending(false);
        },
        (err) => {
          setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, content: `Error: ${err}` } : m)));
          setSending(false);
        },
        pinnedAgent?.name,
      );
    } else {
      try {
        const agentIds = pinnedAgent ? [pinnedAgent.id] : roster.filter(a => a.enabled).map(a => a.id);
        const result = await routeMultiAgent(routeMode, conversation, agentIds);
        const agent = roster.find(a => a.id === result.agentId);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(), role: 'assistant', content: result.content, timestamp: Date.now(),
          answeredBy: agent ? { id: agent.id, name: agent.name, status: statuses[agent.id] ?? 'offline', color: agent.color, initials: agent.initials } : undefined,
          routedForReason: result.routedForReason,
          reasoning: result.reasoning,
          meta: { durationMs: result.durationMs, costUsd: result.costUsd, energyWh: result.energyWh },
        }]);
        if (liveRegionRef.current) liveRegionRef.current.textContent = 'New reply received';
      } catch (err) {
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'request failed'}`, timestamp: Date.now() }]);
      } finally {
        setSending(false);
      }
    }
  }, [messages, roster, pinnedId, routeMode, statuses]);

  if (!chatOpen) return null;

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const chrome = (
    <>
      <div
        onPointerDown={docked ? undefined : startDrag}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: docked ? 48 : 56,
          borderBottom: '1px solid rgba(95,240,216,0.14)', cursor: docked ? 'default' : (isDragging ? 'grabbing' : 'grab'),
          flexShrink: 0, userSelect: 'none',
        }}
      >
        {!docked && <GripVertical size={14} color="#5a7a78" />}
        <HeadAvatar size={docked ? 22 : 28} glow />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#d6efee', flexShrink: 0 }}>Chat</span>

        {!docked && (
          <>
            <select
              value={lastDomainId === 'all' ? 'all' : String(lastDomainId)}
              onChange={e => setLastDomainId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              aria-label="Work domain"
              className="chat-chip-select"
            >
              <option value="all">All domains</option>
              {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select
              value={activeThreadId ?? ''}
              onChange={e => setActiveThreadId(e.target.value || null)}
              aria-label="Thread"
              className="chat-chip-select"
            >
              <option value="">No thread</option>
              {threads.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </>
        )}

        <div style={{ flex: 1 }} />

        <button type="button" onClick={() => setReasoningDefault(!reasoningDefault)} aria-pressed={reasoningDefault} title="Default reasoning visibility" aria-label="Toggle default reasoning visibility" className="chat-icon-btn">
          {reasoningDefault ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button type="button" onClick={() => setDocked(!docked)} title={docked ? 'Float window' : 'Dock to right rail'} aria-label={docked ? 'Float window' : 'Dock to right rail'} className="chat-icon-btn">
          {docked ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
        </button>
        <button type="button" onClick={() => setMinimized(!minimized)} title={minimized ? 'Restore' : 'Minimize'} aria-label={minimized ? 'Restore' : 'Minimize'} className="chat-icon-btn">
          <Minus size={14} />
        </button>
        <button type="button" onClick={() => setChatOpen(false)} title="Close" aria-label="Close chat window" className="chat-icon-btn">
          <X size={14} />
        </button>
      </div>

      {docked && (
        <div style={{ display: 'flex', gap: 6, padding: '6px 10px', borderBottom: '1px solid rgba(95,240,216,0.1)', flexShrink: 0 }}>
          <select value={lastDomainId === 'all' ? 'all' : String(lastDomainId)} onChange={e => setLastDomainId(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label="Work domain" className="chat-chip-select" style={{ flex: 1 }}>
            <option value="all">All domains</option>
            {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={activeThreadId ?? ''} onChange={e => setActiveThreadId(e.target.value || null)} aria-label="Thread" className="chat-chip-select" style={{ flex: 1 }}>
            <option value="">No thread</option>
            {threads.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
    </>
  );

  if (minimized) {
    return (
      <>
        <ChatWindowStyles />
        <button
          type="button"
          className="chat-window"
          style={{
            position: 'fixed', zIndex: 300, right: 24, bottom: 24,
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999,
            background: 'linear-gradient(140deg, rgba(12,36,42,.92), rgba(5,15,20,.97))',
            border: '1px solid rgba(95,240,216,0.3)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            cursor: 'pointer',
          }}
          onClick={() => setMinimized(false)}
          aria-label="Restore chat window"
        >
          <HeadAvatar size={22} />
          <span style={{ fontSize: 12, color: '#d6efee', fontFamily: 'var(--chat-ui)' }}>Chat</span>
        </button>
      </>
    );
  }

  const content = (
    <>
      {chrome}
      <AgentStrip roster={roster} statuses={statuses} pinnedId={pinnedId} onPin={setPinnedId} zdrKnown={false} />
      <div ref={liveRegionRef} aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        <img src={HEAD_SRC} alt="" aria-hidden style={{ position: 'absolute', inset: 0, margin: 'auto', width: '55%', opacity: 0.13, objectFit: 'contain', pointerEvents: 'none', transform: 'translate(1%,-6%)' }} />
        {messages.length === 0 ? (
          <EmptyState
            domains={domains}
            activeDomainId={lastDomainId}
            onPickDomain={setLastDomainId}
            onStarter={sendMessage}
            parked={parked}
            wakeWordActive={wakeWordActive}
            wakeWordBlocked={wakeWordBlocked}
            role={profileRole}
          />
        ) : (
          <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 4px', position: 'relative' }}>
            {activeRuns.map(run => (
              <div key={run.id} style={{ marginBottom: 14 }}>
                <TaskRunCard run={run} onRemove={removeActiveTask} />
              </div>
            ))}
            {messages.map(m => <MessageBubble key={m.id} message={m} />)}
            {sending && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7fa3a6', fontSize: 11 }}>
                <Loader2 size={12} className="chat-spin" /> thinking…
              </div>
            )}
          </div>
        )}
      </div>
      <Composer onSend={sendMessage} sending={sending} routeMode={routeMode} onRouteMode={setRouteMode} focusSignal={focusSignal} />
    </>
  );

  const sharedClassName = `chat-window${reducedMotion ? ' chat-reduced-motion' : ''}`;

  if (docked) {
    return (
      <>
        <ChatWindowStyles />
        <div className={sharedClassName} style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 376, zIndex: 150,
          display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(140deg, rgba(12,36,42,.9), rgba(5,15,20,.96))',
          borderLeft: '1px solid rgba(95,240,216,0.38)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.4)',
        }}>
          {content}
        </div>
      </>
    );
  }

  return (
    <>
      <ChatWindowStyles />
      {showRailDropZone && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 376, zIndex: 149,
          border: '2px dashed rgba(95,240,216,0.5)', background: 'rgba(95,240,216,0.06)', pointerEvents: 'none',
        }} />
      )}
      <div
        className={sharedClassName}
        style={{
          position: 'fixed', left: liveBounds.x, top: liveBounds.y, width: liveBounds.width, height: liveBounds.height, zIndex: 200,
          display: 'flex', flexDirection: 'column', borderRadius: 28,
          background: 'linear-gradient(140deg, rgba(12,36,42,.9), rgba(5,15,20,.96))',
          border: '1px solid rgba(95,240,216,0.38)',
          boxShadow: `0 30px 70px rgba(0,0,0,0.55), 0 0 50px rgba(95,240,216,0.08)${isDragging || isResizing ? ', 0 0 0 2px rgba(95,240,216,0.3)' : ''}`,
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: 'linear-gradient(180deg, rgba(255,255,255,0.06), transparent 40%)', pointerEvents: 'none' }} />
        {content}
      </div>
      {/* Rendered as a sibling, not a child of the overflow:hidden/border-radius:28px
          window above - a corner-positioned child there falls inside the rounded-
          corner clip zone and silently stops being hit-testable (found via direct
          elementFromPoint verification, not assumed - see khameleon-decisions-log.md,
          2026-10-02). */}
      <div
        onPointerDown={startResize}
        title="Resize"
        style={{
          position: 'fixed', left: liveBounds.x + liveBounds.width - 20, top: liveBounds.y + liveBounds.height - 20,
          width: 20, height: 20, zIndex: 201, cursor: 'nwse-resize',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" style={{ opacity: 0.4, margin: 4 }}>
          <path d="M14 14L2 14M14 14L14 2M14 14L8 14M14 14L14 8" stroke="#5ff0d8" strokeWidth="1.2" />
        </svg>
      </div>
    </>
  );
}
