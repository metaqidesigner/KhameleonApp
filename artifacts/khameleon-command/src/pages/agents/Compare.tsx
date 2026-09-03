import React, { useState, useEffect } from 'react';
import { Send, BarChart2 } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { getRoster, compareAgents, FALLBACK_ROSTER, type AgentConfig, type CompareResult } from '@/lib/agentsApi';

export default function Compare() {
  const [roster, setRoster] = useState<AgentConfig[]>(FALLBACK_ROSTER);
  const [selectedIds, setSelectedIds] = useState<string[]>(['claude', 'gpt4o', 'gemini']);
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState<CompareResult[]>([]);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string>();

  useEffect(() => { getRoster().then(setRoster).catch(() => {}); }, []);

  async function run() {
    if (!prompt.trim() || running || !selectedIds.length) return;
    setRunning(true);
    setResults([]);
    setRunError(undefined);
    try {
      const res = await compareAgents(prompt, selectedIds);
      setResults(res.comparison);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Comparison request failed');
    } finally {
      setRunning(false);
    }
  }

  function toggleAgent(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const fastest = results.length ? results.reduce((a, b) => (b.error || a.latencyMs < b.latencyMs ? a : b)) : null;
  const cheapest = results.length ? results.reduce((a, b) => (b.error || a.costUsd < b.costUsd ? a : b)) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, gap: 6 }}>
      {/* prompt bar */}
      <div style={{ display: 'flex', gap: 6 }}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) run(); }}
          placeholder="Enter prompt to run across all selected agents side-by-side..."
          style={{ flex: 1, height: 44, padding: '8px 12px', background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--j-text)', fontFamily: 'var(--j-font-mono)', fontSize: 11, resize: 'none', outline: 'none' }}
        />
        <button className="j-btn-primary" style={{ width: 44, height: 44, padding: 0, flexShrink: 0 }} onClick={run} disabled={running || !prompt.trim() || !selectedIds.length}>
          {running ? <div style={{ width: 14, height: 14, border: '2px solid rgba(0,212,255,0.3)', borderTop: '2px solid var(--j-cyan)', borderRadius: '50%', animation: 'jarvis-spin 0.8s linear infinite' }} /> : <Send size={14} />}
        </button>
      </div>

      {/* agent selector */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {roster.map(a => {
          const sel = selectedIds.includes(a.id);
          return (
            <button key={a.id} onClick={() => toggleAgent(a.id)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: sel ? `${a.color}20` : 'rgba(0,212,255,0.03)', border: `1px solid ${sel ? a.color : 'rgba(0,212,255,0.1)'}`, cursor: 'pointer', color: sel ? a.color : 'var(--j-text-muted)', fontFamily: 'var(--j-font-ui)', fontSize: 9, transition: 'all 0.15s' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: sel ? a.color : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, color: sel ? '#000' : 'var(--j-text-muted)' }}>{a.initials}</div>
              {a.name}
            </button>
          );
        })}
      </div>

      {runError && !running && (
        <div style={{ fontSize: '11px', color: '#E77A7A' }}>{runError}</div>
      )}

      {/* comparison table */}
      {results.length > 0 && !running && (
        <div style={{ overflowX: 'auto' }}>
          <table className="j-table" style={{ width: '100%' }}>
            <thead className="j-table-header">
              <tr><th>AGENT</th><th>LATENCY</th><th>TOKENS</th><th>COST</th><th>STATUS</th></tr>
            </thead>
            <tbody>
              {results.map(r => {
                const cfg = roster.find(a => a.id === r.agentId);
                return (
                  <tr key={r.agentId}>
                    <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: cfg?.color ?? '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, color: '#000' }}>{cfg?.initials ?? '?'}</div>
                      <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11 }}>{cfg?.name ?? r.agentId}</span>
                    </td>
                    <td className="j-mono" style={{ color: r.agentId === fastest?.agentId ? 'var(--j-green)' : undefined }}>{r.error ? '—' : `${r.latencyMs}ms`}</td>
                    <td className="j-mono">{r.error ? '—' : r.tokens}</td>
                    <td className="j-mono" style={{ color: r.agentId === cheapest?.agentId ? 'var(--j-green)' : undefined }}>{r.error ? '—' : `$${r.costUsd.toFixed(5)}`}</td>
                    <td>{r.error ? <span className="j-badge j-badge-red">ERROR</span> : <span className="j-badge j-badge-cyan">OK</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* side-by-side responses */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: `repeat(${Math.min(results.length || selectedIds.length, 3)}, 1fr)`, gap: 6 }} className="scrollbar-jarvis">
        {running ? (
          <div className="j-empty" style={{ gridColumn: '1/-1' }}>
            <div style={{ width: 40, height: 40, border: '2px solid rgba(0,212,255,0.2)', borderTop: '2px solid var(--j-cyan)', borderRadius: '50%', animation: 'jarvis-spin 0.8s linear infinite' }} />
            RUNNING COMPARISON ACROSS {selectedIds.length} AGENTS...
          </div>
        ) : results.length === 0 ? (
          <div className="j-empty" style={{ gridColumn: '1/-1' }}>
            <BarChart2 size={32} color="var(--j-text-faint)" />
            COMPARE RESPONSES SIDE BY SIDE
          </div>
        ) : results.map(r => {
          const cfg = roster.find(a => a.id === r.agentId);
          return (
            <JPanel key={r.agentId} title={cfg?.name ?? r.agentId}>
              <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 11, color: r.error ? 'var(--j-red)' : 'var(--j-text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', height: '100%', overflowY: 'auto' }} className="scrollbar-jarvis">
                {r.error ?? r.content}
              </div>
            </JPanel>
          );
        })}
      </div>
    </div>
  );
}
