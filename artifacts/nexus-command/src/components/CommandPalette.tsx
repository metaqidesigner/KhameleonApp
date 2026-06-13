import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, LayoutDashboard, MessageSquare, FlaskConical, BrainCircuit, Bot, Settings, Zap } from 'lucide-react';
import { useJarvisStore, type ModuleId, type AgentType } from '@/store/jarvisStore';
import { streamChat } from '@/lib/jarvisApi';

const MODULES: { id: ModuleId; label: string; Icon: React.FC<{ style?: React.CSSProperties }> }[] = [
  { id: 'dashboard',      label: 'Dashboard',      Icon: LayoutDashboard },
  { id: 'chat',           label: 'Chat',            Icon: MessageSquare },
  { id: 'research',       label: 'Research',        Icon: FlaskConical },
  { id: 'memory',         label: 'Memory',          Icon: BrainCircuit },
  { id: 'agents',         label: 'Agents',          Icon: Bot },
  { id: 'analytics',      label: 'Analytics',       Icon: Zap },
  { id: 'settings',       label: 'Settings',        Icon: Settings },
];

const AGENTS: { id: AgentType; label: string }[] = [
  { id: 'simple',        label: '@simple' },
  { id: 'orchestrator',  label: '@orchestrator' },
  { id: 'deep_research', label: '@deep_research' },
  { id: 'code_assistant',label: '@code_assistant' },
  { id: 'morning_digest',label: '@morning_digest' },
];

const AGENT_TYPES: AgentType[] = ['simple', 'orchestrator', 'deep_research', 'code_assistant'];

interface ResultItem {
  group: string;
  label: string;
  hint?: string;
  action: () => void;
  Icon?: React.FC<{ style?: React.CSSProperties }>;
}

export function CommandPalette() {
  const {
    commandPaletteOpen, setCommandPaletteOpen,
    setActiveModule, agentHistory,
    selectedAgent, setSelectedAgent,
    setStreaming, pushAgentEvent,
    newSession, appendMessage, setActiveSession,
  } = useJarvisStore();

  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ⌘K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (e.key === 'Escape') setCommandPaletteOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandPaletteOpen]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Build result list
  const q = query.toLowerCase().trim();

  const results: ResultItem[] = [];

  // Recent queries
  if (!q) {
    agentHistory.slice(0, 5).forEach(ev => {
      results.push({
        group: 'RECENT',
        label: ev.prompt.slice(0, 60) + (ev.prompt.length > 60 ? '…' : ''),
        hint: ev.agent,
        action: () => {
          setQuery(ev.prompt);
        },
      });
    });
  }

  // Modules
  MODULES.filter(m => !q || m.label.toLowerCase().includes(q)).forEach(m => {
    results.push({
      group: 'MODULES',
      label: m.label,
      Icon: m.Icon,
      action: () => {
        setActiveModule(m.id);
        setCommandPaletteOpen(false);
      },
    });
  });

  // Agents
  AGENTS.filter(a => !q || a.label.toLowerCase().includes(q)).forEach(a => {
    results.push({
      group: 'AGENTS',
      label: a.label,
      hint: 'set agent',
      action: () => {
        setSelectedAgent(a.id);
        setCommandPaletteOpen(false);
      },
    });
  });

  // Actions
  const ACTIONS = [
    { label: 'Run morning digest', hint: 'morning_digest agent', action: () => { submitQuery('Give me my morning digest', 'morning_digest'); } },
    { label: 'Open Settings', hint: 'navigate', action: () => { setActiveModule('settings'); setCommandPaletteOpen(false); } },
  ];
  ACTIONS.filter(a => !q || a.label.toLowerCase().includes(q)).forEach(a => {
    results.push({ group: 'ACTIONS', label: a.label, hint: a.hint, action: a.action });
  });

  const submitQuery = useCallback((text: string, agent?: AgentType) => {
    if (!text.trim()) return;
    setCommandPaletteOpen(false);
    setActiveModule('chat');

    const sessionId = newSession(agent ?? selectedAgent);
    setActiveSession(sessionId);

    const userMsg = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: text,
      timestamp: Date.now(),
    };
    appendMessage(sessionId, userMsg);
    setStreaming(true);

    const aiMsgId = crypto.randomUUID();
    appendMessage(sessionId, { id: aiMsgId, role: 'assistant', content: '', timestamp: Date.now() });

    let acc = '';
    const ts = Date.now();
    streamChat(
      text,
      agent ?? selectedAgent,
      (token) => {
        acc += token;
        useJarvisStore.setState(st => ({
          chatSessions: st.chatSessions.map(s =>
            s.id === sessionId
              ? { ...s, messages: s.messages.map(m => m.id === aiMsgId ? { ...m, content: acc } : m) }
              : s
          ),
        }));
      },
      (payload) => {
        setStreaming(false);
        useJarvisStore.setState(st => ({
          chatSessions: st.chatSessions.map(s =>
            s.id === sessionId
              ? {
                  ...s,
                  messages: s.messages.map(m =>
                    m.id === aiMsgId
                      ? { ...m, content: acc, model: payload.model ?? undefined, latencyMs: payload.latency_ms, tokens: payload.tokens, costUsd: payload.cost_usd, energyWh: payload.energy_wh }
                      : m
                  ),
                }
              : s
          ),
        }));
        pushAgentEvent({
          id: crypto.randomUUID(),
          prompt: text,
          response: acc,
          model: payload.model ?? 'unknown',
          agent: agent ?? selectedAgent,
          ts,
          durationMs: Date.now() - ts,
        });
      },
    );
  }, [selectedAgent, setCommandPaletteOpen, setActiveModule, newSession, setActiveSession, appendMessage, setStreaming, pushAgentEvent]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (q && cursor === results.length) {
        submitQuery(query);
      } else if (results[cursor]) {
        results[cursor].action();
      }
    }
    if (e.key === 'Escape') setCommandPaletteOpen(false);
  };

  if (!commandPaletteOpen) return null;

  // Group rendering
  let lastGroup = '';
  const rendered: React.ReactNode[] = [];
  results.forEach((r, i) => {
    if (r.group !== lastGroup) {
      lastGroup = r.group;
      rendered.push(
        <div key={`g-${r.group}`} style={{ padding: '6px 12px 2px', fontSize: 10, fontFamily: 'var(--font-mono)', color: '#484f58', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {r.group}
        </div>
      );
    }
    const active = cursor === i;
    rendered.push(
      <div
        key={i}
        onClick={r.action}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '7px 12px', cursor: 'pointer',
          background: active ? '#21262d' : 'transparent',
          borderLeft: active ? '2px solid #58a6ff' : '2px solid transparent',
        }}
        onMouseEnter={() => setCursor(i)}
      >
        {r.Icon && <r.Icon style={{ width: 14, height: 14, color: '#8b949e', flexShrink: 0 }} />}
        {!r.Icon && <span style={{ width: 14, flexShrink: 0 }} />}
        <span style={{ flex: 1, fontSize: 13, color: active ? '#e6edf3' : '#8b949e' }}>{r.label}</span>
        {r.hint && <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#484f58' }}>{r.hint}</span>}
      </div>
    );
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: 80,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) setCommandPaletteOpen(false); }}
    >
      <div style={{
        width: '100%', maxWidth: 600,
        background: '#161b22',
        border: '1px solid #30363d',
        borderRadius: 8,
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        maxHeight: 480,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 12px',
          borderBottom: '1px solid #30363d',
          height: 48,
        }}>
          <Search style={{ width: 15, height: 15, color: '#8b949e', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Ask Jarvis anything, or jump to a module..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#e6edf3', fontSize: 14, fontFamily: 'var(--font-ui)',
            }}
          />
          <kbd style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#484f58', background: '#0d1117', border: '1px solid #30363d', borderRadius: 3, padding: '0 5px', lineHeight: '18px' }}>Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto' }} className="scrollbar-thin">
          {rendered}
          {results.length === 0 && (
            <div style={{ padding: '20px 16px', color: '#484f58', fontSize: 12 }}>No results</div>
          )}
        </div>

        {/* Bottom bar */}
        <div style={{
          height: 36, flexShrink: 0,
          borderTop: '1px solid #30363d',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px',
        }}>
          {/* Agent pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {AGENT_TYPES.map(a => (
              <button
                key={a}
                onClick={() => setSelectedAgent(a)}
                className={`j-pill ${selectedAgent === a ? 'j-pill-active' : ''}`}
                style={{ height: 20, padding: '0 8px', fontSize: 10 }}
              >
                {a.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#484f58' }}>
            ↵ run · ↑↓ navigate · Esc close
          </span>
        </div>
      </div>
    </div>
  );
}
