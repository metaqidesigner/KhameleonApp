import { useEffect, useRef, useState } from 'react';
import { Search, LayoutDashboard, Bot, FlaskConical, BrainCircuit, Shield, BarChart2, Settings, MessageSquare, Zap, FolderKanban, Plug, CalendarDays, Inbox, Lock } from 'lucide-react';
import { useJarvisStore, type TabId, type AgentType } from '@/store/jarvisStore';

const MODULES: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'canvas',    label: 'CANVAS',    icon: <LayoutDashboard size={13}/> },
  { id: 'agents',    label: 'AGENTS',    icon: <Bot size={13}/> },
  { id: 'projects',  label: 'PROJECTS',  icon: <FolderKanban size={13}/> },
  { id: 'calendar',  label: 'CALENDAR',  icon: <CalendarDays size={13}/> },
  { id: 'inbox',     label: 'INBOX',     icon: <Inbox size={13}/> },
  { id: 'research',  label: 'RESEARCH',  icon: <FlaskConical size={13}/> },
  { id: 'memory',    label: 'MEMORY',    icon: <BrainCircuit size={13}/> },
  { id: 'comms',     label: 'COMMS',     icon: <MessageSquare size={13}/> },
  { id: 'analytics', label: 'ANALYTICS', icon: <BarChart2 size={13}/> },
  { id: 'security',  label: 'SECURITY',  icon: <Shield size={13}/> },
  { id: 'vault',     label: 'VAULT',     icon: <Lock size={13}/> },
  { id: 'skills',       label: 'SKILL SETS',  icon: <Zap size={13}/> },
  { id: 'integrations', label: 'INTEGRATIONS', icon: <Plug size={13}/> },
  { id: 'settings',  label: 'SETTINGS',  icon: <Settings size={13}/> },
];

const AGENTS: { id: AgentType; label: string }[] = [
  { id: 'simple',          label: 'SIMPLE' },
  { id: 'orchestrator',    label: 'ORCHESTRATOR' },
  { id: 'deep_research',   label: 'DEEP RESEARCH' },
  { id: 'morning_digest',  label: 'MORNING DIGEST' },
  { id: 'code_assistant',  label: 'CODE ASSISTANT' },
];

const ACTIONS = [
  { id: 'morning', label: 'RUN MORNING DIGEST' },
  { id: 'research', label: 'INITIATE DEEP RESEARCH' },
  { id: 'index', label: 'INDEX MEMORY PATH' },
  { id: 'diag', label: 'RUN DIAGNOSTICS' },
];

type ResultItem =
  | { kind: 'module'; id: TabId; label: string; icon: React.ReactNode }
  | { kind: 'agent';  id: AgentType; label: string }
  | { kind: 'action'; id: string; label: string };

export default function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveTab, setSelectedAgent, setChatOpen, selectedAgent } = useJarvisStore();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (commandPaletteOpen) { setQuery(''); setCursor(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [commandPaletteOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setCommandPaletteOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandPaletteOpen]);

  const q = query.toLowerCase();
  const results: ResultItem[] = [];
  MODULES.forEach(m => { if (!q || m.label.toLowerCase().includes(q)) results.push({ kind:'module', ...m }); });
  AGENTS.forEach(a  => { if (!q || a.label.toLowerCase().includes(q)) results.push({ kind:'agent',  ...a }); });
  ACTIONS.forEach(a => { if (!q || a.label.toLowerCase().includes(q)) results.push({ kind:'action', ...a }); });

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); activate(results[cursor]); }
  };

  const activate = (item: ResultItem | undefined) => {
    if (!item) {
      if (query.trim()) { setChatOpen(true); setCommandPaletteOpen(false); }
      return;
    }
    if (item.kind === 'module') { setActiveTab(item.id); }
    if (item.kind === 'agent')  { setSelectedAgent(item.id); setChatOpen(true); }
    if (item.kind === 'action') { setActiveTab('canvas'); }
    setCommandPaletteOpen(false);
  };

  if (!commandPaletteOpen) return null;

  const groupLabels: Record<string, string> = { module:'MODULES', agent:'AGENTS', action:'ACTIONS' };
  let lastKind = '';

  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80 }}
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div
        style={{ width:600, background:'rgba(0,4,12,0.97)', border:'1px solid rgba(0,212,255,0.4)', boxShadow:'0 0 40px rgba(0,212,255,0.2), 0 24px 60px rgba(0,0,0,0.8)', position:'relative' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Corner brackets */}
        <div style={{ position:'absolute', top:-1, left:-1, width:14, height:14, borderTop:'2px solid #00d4ff', borderLeft:'2px solid #00d4ff', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-1, right:-1, width:14, height:14, borderBottom:'2px solid #00d4ff', borderRight:'2px solid #00d4ff', pointerEvents:'none' }} />

        {/* Input */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 14px', borderBottom:'1px solid rgba(0,212,255,0.2)', height:50 }}>
          <Search size={16} color="var(--j-cyan)" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={onKey}
            placeholder="QUERY KHAMELEON..."
            style={{
              flex:1, background:'transparent', border:'none', outline:'none',
              fontFamily:'var(--j-font-head)', fontSize:14, color:'var(--j-cyan)',
              caretColor:'var(--j-cyan)', letterSpacing:'0.04em',
            }}
          />
          <span className="j-blink" style={{ fontFamily:'var(--j-font-mono)', fontSize:16, color:'var(--j-cyan)', lineHeight:1 }}>▌</span>
        </div>

        {/* Results */}
        <div style={{ maxHeight:400, overflowY:'auto' }} className="scrollbar-jarvis">
          {results.map((item, i) => {
            const showGroup = item.kind !== lastKind;
            lastKind = item.kind;
            return (
              <div key={`${item.kind}-${item.id}`}>
                {showGroup && (
                  <div style={{ padding:'6px 14px 4px', fontFamily:'var(--j-font-ui)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.2em', color:'var(--j-red)', borderTop: i > 0 ? '1px solid rgba(192,21,42,0.2)' : 'none', background: 'linear-gradient(90deg, rgba(107,0,0,0.3), transparent)' }}>
                    {groupLabels[item.kind]}
                  </div>
                )}
                <div
                  onClick={() => activate(item)}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', cursor:'pointer', background: i === cursor ? 'rgba(0,212,255,0.08)' : 'transparent', borderLeft: i === cursor ? '2px solid var(--j-cyan)' : '2px solid transparent', transition:'background 0.1s' }}
                  onMouseEnter={() => setCursor(i)}
                >
                  <span style={{ color:'var(--j-cyan)', fontFamily:'var(--j-font-mono)', fontSize:12 }}>→</span>
                  {'icon' in item && <span style={{ color:'var(--j-text-muted)' }}>{item.icon as React.ReactNode}</span>}
                  <span style={{ fontFamily:'var(--j-font-ui)', fontSize:13, fontWeight:600, color: i === cursor ? 'var(--j-text)' : 'var(--j-text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                    {item.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Agent pills */}
        <div style={{ display:'flex', gap:6, padding:'10px 14px', borderTop:'1px solid rgba(0,212,255,0.12)' }}>
          {AGENTS.map(a => (
            <button
              key={a.id}
              onClick={() => { setSelectedAgent(a.id); }}
              style={{ fontFamily:'var(--j-font-mono)', fontSize:9, padding:'3px 8px', textTransform:'uppercase', letterSpacing:'0.06em', cursor:'pointer', border:'1px solid', background: selectedAgent === a.id ? 'var(--j-red)' : 'transparent', borderColor: selectedAgent === a.id ? 'var(--j-red)' : 'rgba(0,212,255,0.25)', color: selectedAgent === a.id ? '#fff' : 'var(--j-text-muted)', transition:'all 0.15s' }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
