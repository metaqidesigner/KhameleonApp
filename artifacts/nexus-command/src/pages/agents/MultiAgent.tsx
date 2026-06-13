import React, { useState, useEffect } from 'react';
import { Send, Zap, Vote } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { getRoster, askAll, FALLBACK_ROSTER, STATUS_COLOR, type AgentConfig, type AgentResponse } from '@/lib/agentsApi';

type Mode = 'parallel' | 'vote';

export default function MultiAgent() {
  const [roster, setRoster] = useState<AgentConfig[]>(FALLBACK_ROSTER);
  const [selectedIds, setSelectedIds] = useState<string[]>(['claude', 'gpt4o']);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<Mode>('parallel');
  const [results, setResults] = useState<AgentResponse[]>([]);
  const [verdict, setVerdict] = useState<AgentResponse | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => { getRoster().then(setRoster).catch(() => {}); }, []);

  async function run() {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setResults([]);
    setVerdict(null);
    try {
      const res = await askAll([{ role: 'user', content: prompt }], selectedIds, mode);
      setResults(res.results);
      if (res.verdict) setVerdict(res.verdict);
    } finally {
      setRunning(false);
    }
  }

  function toggleAgent(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, gap: 6 }}>
      {/* controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
        <JPanel title="PROMPT" style={{ padding: '8px 10px' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) run(); }}
              placeholder="Enter prompt to broadcast to all selected agents..."
              style={{ flex: 1, height: 52, padding: '6px 10px', background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--j-text)', fontFamily: 'var(--j-font-mono)', fontSize: 11, resize: 'none', outline: 'none' }}
            />
            <button className="j-btn-primary" style={{ width: 52, height: 52, padding: 0 }} onClick={run} disabled={running || !prompt.trim() || !selectedIds.length}>
              {running ? <div style={{ width: 14, height: 14, border: '2px solid rgba(0,212,255,0.3)', borderTop: '2px solid var(--j-cyan)', borderRadius: '50%', animation: 'jarvis-spin 0.8s linear infinite' }} /> : <Send size={15} />}
            </button>
          </div>
        </JPanel>
        <JPanel title="MODE">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {([['parallel', 'PARALLEL', <Zap size={11}/>], ['vote', 'VOTE', <Vote size={11}/>]] as const).map(([val, label, icon]) => (
              <button
                key={val}
                className={mode === val ? 'j-btn-primary' : 'j-btn-ghost'}
                style={{ height: 28, fontSize: 9, justifyContent: 'flex-start', gap: 5 }}
                onClick={() => setMode(val)}
              >
                {icon}{label}
              </button>
            ))}
          </div>
        </JPanel>
      </div>

      {/* agent selector */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {roster.map(a => {
          const sel = selectedIds.includes(a.id);
          return (
            <button
              key={a.id}
              onClick={() => toggleAgent(a.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: sel ? `${a.color}20` : 'rgba(0,212,255,0.03)', border: `1px solid ${sel ? a.color : 'rgba(0,212,255,0.1)'}`, cursor: 'pointer', color: sel ? a.color : 'var(--j-text-muted)', fontFamily: 'var(--j-font-head)', fontSize: 10, letterSpacing: '0.06em', transition: 'all 0.15s' }}
            >
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: sel ? a.color : 'rgba(0,212,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--j-font-head)', fontSize: 8, fontWeight: 700, color: sel ? '#000' : 'var(--j-text-muted)' }}>{a.initials}</div>
              {a.name}
            </button>
          );
        })}
      </div>

      {/* results */}
      <div style={{ flex: 1, overflowY: 'auto' }} className="scrollbar-jarvis">
        {running ? (
          <div className="j-empty">
            <div style={{ width: 40, height: 40, border: '2px solid rgba(0,212,255,0.2)', borderTop: '2px solid var(--j-cyan)', borderRadius: '50%', animation: 'jarvis-spin 0.8s linear infinite' }} />
            QUERYING {selectedIds.length} AGENTS IN {mode.toUpperCase()} MODE...
          </div>
        ) : results.length === 0 ? (
          <div className="j-empty">
            <Zap size={32} color="var(--j-text-faint)" />
            SELECT AGENTS AND SEND A PROMPT
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map(r => {
              const agentCfg = roster.find(a => a.id === r.agentId);
              return (
                <div key={r.agentId} style={{ padding: '10px 12px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: agentCfg?.color ?? '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--j-font-head)', fontSize: 9, fontWeight: 700, color: '#000' }}>{agentCfg?.initials ?? '?'}</div>
                    <span style={{ fontFamily: 'var(--j-font-head)', fontSize: 11, color: '#fff' }}>{agentCfg?.name ?? r.agentId}</span>
                    {r.error ? (
                      <span className="j-badge j-badge-red" style={{ marginLeft: 'auto' }}>ERROR</span>
                    ) : (
                      <>
                        <span className="j-mono" style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--j-text-faint)' }}>{r.latencyMs}ms</span>
                        <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)' }}>{r.tokens} tok</span>
                        <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)' }}>${r.costUsd.toFixed(5)}</span>
                      </>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 11, color: r.error ? 'var(--j-red)' : 'var(--j-text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {r.error ?? r.content}
                  </div>
                </div>
              );
            })}
            {verdict && (
              <div style={{ padding: '10px 12px', background: 'rgba(192,21,42,0.06)', border: '1px solid rgba(192,21,42,0.25)' }}>
                <div style={{ fontFamily: 'var(--j-font-head)', fontSize: 10, color: 'var(--j-red)', letterSpacing: '0.08em', marginBottom: 8 }}>⚖ JUDGE VERDICT</div>
                <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 11, color: 'var(--j-text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{verdict.content}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
