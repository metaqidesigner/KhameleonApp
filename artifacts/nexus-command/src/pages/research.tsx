import { useState } from 'react';
import { FlaskConical, Send, Hash, Cpu } from 'lucide-react';
import { marked } from 'marked';
import { runResearch, streamChat } from '@/lib/jarvisApi';
import { useNexusStore } from '@/store/nexusStore';

export default function Research() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [model, setModel] = useState<string | null>(null);
  const [tokenEstimate, setTokenEstimate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamMode, setStreamMode] = useState(true);
  const { setStreaming, pushAgentEvent } = useNexusStore();

  const handleResearch = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setResult('');
    setModel(null);
    setTokenEstimate(null);
    const ts = Date.now();

    if (streamMode) {
      setStreaming(true);
      let acc = '';
      const cleanup = streamChat(query, 'deep_research',
        (token) => { acc += token; setResult(acc); },
        (mdl) => {
          setLoading(false);
          setStreaming(false);
          setModel(mdl);
          setTokenEstimate(Math.round(acc.length / 4));
          pushAgentEvent({ id: crypto.randomUUID(), prompt: query, response: acc, model: mdl ?? 'unknown', agent: 'deep_research', ts, durationMs: Date.now() - ts });
          cleanup();
        },
      );
    } else {
      const res = await runResearch(query);
      setResult(res.content);
      setModel(res.model);
      setTokenEstimate(Math.round(res.content.length / 4));
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Deep Research</h2>
        <p style={{ fontSize: 12, color: 'rgba(130,170,200,0.55)', lineHeight: 1.5 }}>Nexus will conduct a thorough research session using the deep_research agent and return a structured markdown report.</p>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[{ id: true, label: 'Stream' }, { id: false, label: 'Batch' }].map(m => (
          <button key={String(m.id)} onClick={() => setStreamMode(m.id)}
            className={`nexus-pill ${streamMode === m.id ? 'nexus-pill-cyan' : 'nexus-pill-ghost'}`}
            style={{ cursor: 'pointer', fontSize: 10, padding: '3px 12px' }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="nexus-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="nexus-input" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleResearch()}
            placeholder="e.g. 'Latest advances in quantum error correction 2024'" />
          <button className="nexus-btn" onClick={handleResearch} disabled={loading || !query.trim()}
            style={{ flexShrink: 0, borderColor: 'rgba(56,189,248,0.4)', color: '#38bdf8', background: 'rgba(56,189,248,0.1)' }}>
            {loading ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(56,189,248,0.3)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Researching…</> : <><Send style={{ width: 13, height: 13 }} /> Deep Research</>}
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && !result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="nexus-shimmer" style={{ height: 18, borderRadius: 6, width: `${75 + Math.random() * 20}%` }} />
          ))}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="nexus-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <FlaskConical style={{ width: 14, height: 14, color: '#38bdf8' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(56,189,248,0.8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Research Report</span>
          </div>

          <div className="nexus-prose" dangerouslySetInnerHTML={{ __html: marked.parse(result) as string }} />

          {(model || tokenEstimate) && (
            <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid rgba(0,212,255,0.08)', display: 'flex', gap: 20 }}>
              {tokenEstimate && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'rgba(0,212,255,0.45)', fontFamily: 'var(--font-mono)' }}>
                  <Hash style={{ width: 11, height: 11 }} /> ~{tokenEstimate.toLocaleString()} tokens
                </div>
              )}
              {model && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'rgba(0,212,255,0.45)', fontFamily: 'var(--font-mono)' }}>
                  <Cpu style={{ width: 11, height: 11 }} /> {model.toUpperCase()}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
