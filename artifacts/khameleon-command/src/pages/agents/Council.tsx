import React, { useState, useEffect } from 'react';
import { Send, Users } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { getRoster, askAll, FALLBACK_ROSTER, type AgentConfig, type AgentResponse } from '@/lib/agentsApi';

interface Round {
  ts: number;
  prompt: string;
  responses: AgentResponse[];
  synthesis?: AgentResponse;
}

export default function Council() {
  const [roster, setRoster] = useState<AgentConfig[]>(FALLBACK_ROSTER);
  const [selectedIds, setSelectedIds] = useState<string[]>(['claude', 'gpt4o', 'gemini']);
  const [prompt, setPrompt] = useState('');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => { getRoster().then(setRoster).catch(() => {}); }, []);

  async function runCouncil() {
    if (!prompt.trim() || running || !selectedIds.length) return;
    setRunning(true);
    const p = prompt.trim();
    setPrompt('');

    try {
      const res = await askAll([{ role: 'user', content: p }], selectedIds, 'vote');
      setRounds(prev => [...prev, {
        ts: Date.now(),
        prompt: p,
        responses: res.results,
        synthesis: res.verdict,
      }]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, gap: 6 }}>
      <JPanel title="COUNCIL MODE — AGENTS DELIBERATE, SYNTHESISE BEST ANSWER" badge="BETA">
        <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'var(--j-text-muted)', lineHeight: 1.6 }}>
          All selected agents independently respond to your prompt. A judge agent then synthesises the best answer.
        </div>
      </JPanel>

      {/* agent selector */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {roster.map(a => {
          const sel = selectedIds.includes(a.id);
          return (
            <button key={a.id} onClick={() => setSelectedIds(prev => prev.includes(a.id) ? prev.filter(x => x !== a.id) : [...prev, a.id])}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px', background: sel ? `${a.color}20` : 'rgba(0,212,255,0.03)', border: `1px solid ${sel ? a.color : 'rgba(0,212,255,0.1)'}`, cursor: 'pointer', color: sel ? a.color : 'var(--j-text-muted)', fontFamily: 'var(--j-font-ui)', fontSize: 9, transition: 'all 0.15s' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: sel ? a.color : '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, color: sel ? '#000' : 'var(--j-text-muted)' }}>{a.initials}</div>
              {a.name}
            </button>
          );
        })}
      </div>

      {/* session */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }} className="scrollbar-jarvis">
        {rounds.length === 0 && !running ? (
          <div className="j-empty">
            <Users size={36} color="var(--j-text-faint)" />
            CONVENE THE COUNCIL — POSE A QUESTION
          </div>
        ) : (
          <>
            {rounds.map((round, ri) => (
              <div key={ri} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* question */}
                <div style={{ padding: '8px 12px', background: 'rgba(192,21,42,0.07)', border: '1px solid rgba(192,21,42,0.2)', fontFamily: 'var(--j-font-ui)', fontSize: 12, color: 'var(--j-text)' }}>
                  ▶ {round.prompt}
                </div>
                {/* individual responses */}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(round.responses.length, 3)}, 1fr)`, gap: 5 }}>
                  {round.responses.map(r => {
                    const cfg = roster.find(a => a.id === r.agentId);
                    return (
                      <div key={r.agentId} style={{ padding: '8px 10px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.08)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: cfg?.color ?? '#00d4ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#000' }}>{cfg?.initials ?? '?'}</div>
                          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, color: '#fff' }}>{cfg?.name ?? r.agentId}</span>
                          <span className="j-mono" style={{ marginLeft: 'auto', fontSize: 8, color: 'var(--j-text-faint)' }}>{r.latencyMs}ms</span>
                        </div>
                        <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 10, color: r.error ? 'var(--j-red)' : 'var(--j-text)', lineHeight: 1.55, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto' }} className="scrollbar-jarvis">
                          {r.error ?? r.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* synthesis */}
                {round.synthesis && (
                  <div style={{ padding: '10px 12px', background: 'rgba(192,21,42,0.06)', border: '1px solid rgba(192,21,42,0.3)', borderLeft: '3px solid var(--j-red)' }}>
                    <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-red)', letterSpacing: '0.08em', marginBottom: 8 }}>⚖ COUNCIL SYNTHESIS</div>
                    <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 11, color: 'var(--j-text)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{round.synthesis.content}</div>
                  </div>
                )}
              </div>
            ))}
            {running && (
              <div className="j-empty" style={{ padding: '20px 0' }}>
                <div style={{ width: 32, height: 32, border: '2px solid rgba(0,212,255,0.2)', borderTop: '2px solid var(--j-cyan)', borderRadius: '50%', animation: 'jarvis-spin 0.8s linear infinite' }} />
                COUNCIL IN SESSION...
              </div>
            )}
          </>
        )}
      </div>

      {/* input */}
      <div style={{ display: 'flex', gap: 6 }}>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) runCouncil(); }}
          placeholder="Pose a question to the council... (Ctrl+Enter to submit)"
          style={{ flex: 1, height: 44, padding: '8px 12px', background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)', color: 'var(--j-text)', fontFamily: 'var(--j-font-mono)', fontSize: 12, resize: 'none', outline: 'none' }}
        />
        <button className="j-btn-primary" style={{ width: 44, height: 44, padding: 0, flexShrink: 0 }} onClick={runCouncil} disabled={running || !prompt.trim() || !selectedIds.length}>
          {running ? <div style={{ width: 14, height: 14, border: '2px solid rgba(0,212,255,0.3)', borderTop: '2px solid var(--j-cyan)', borderRadius: '50%', animation: 'jarvis-spin 0.8s linear infinite' }} /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
}
