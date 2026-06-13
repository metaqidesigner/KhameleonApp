import { useState, useRef } from 'react';
import { marked } from 'marked';
import { runResearch } from '@/lib/jarvisApi';
import { ChevronDown, ChevronRight, Copy, Save } from 'lucide-react';

interface TraceEntry { tool: string; result: string; }

function fmt(v: number | undefined, d = 0, suf = '') {
  if (v === undefined) return '—';
  return v.toFixed(d) + suf;
}

export default function Research() {
  const [query, setQuery]     = useState('');
  const [maxIter, setMaxIter] = useState(5);
  const [webSearch, setWebSearch] = useState(true);
  const [saveMemory, setSaveMemory] = useState(false);
  const [showOpts, setShowOpts]   = useState(false);
  const [showTrace, setShowTrace] = useState(false);

  const [result, setResult]   = useState('');
  const [trace, setTrace]     = useState<TraceEntry[]>([]);
  const [meta, setMeta]       = useState<{ model?: string; latencyMs?: number; tokens?: number; costUsd?: number; energyWh?: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setResult('');
    setTrace([]);
    setMeta(null);

    try {
      const res = await runResearch(query, { max_iterations: maxIter, web_search: webSearch });
      setResult(res.content);
      setMeta({
        model: res.model ?? undefined,
        latencyMs: res.latency_ms,
        tokens: res.tokens,
        costUsd: res.cost_usd,
        energyWh: res.energy_wh,
      });
      // Parse tool calls from content if present
      const toolMatches = res.content.matchAll(/\[tool:([^\]]+)\] → ([^\n]+)/g);
      const entries: TraceEntry[] = [];
      for (const m of toolMatches) entries.push({ tool: m[1], result: m[2] });
      if (entries.length) setTrace(entries);
    } catch {
      setResult('Error running research. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Deep Research</h1>
          <p>Extended multi-step research with web retrieval</p>
        </div>
      </div>
      <div className="j-page-content" style={{ display: 'flex', gap: 16, height: '100%', overflow: 'hidden' }}>
        {/* Left panel — input */}
        <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="j-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="j-card-header">Query</div>
            <textarea
              className="j-textarea"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Enter your research question..."
              style={{ flex: 1, minHeight: 140, resize: 'none' }}
            />

            {/* Options toggle */}
            <button
              onClick={() => setShowOpts(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#8b949e', fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              {showOpts ? <ChevronDown style={{ width: 13, height: 13 }} /> : <ChevronRight style={{ width: 13, height: 13 }} />}
              Options
            </button>
            {showOpts && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0', borderTop: '1px solid #30363d' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#8b949e' }}>
                  Max iterations
                  <input type="number" value={maxIter} onChange={e => setMaxIter(+e.target.value)} min={1} max={20}
                    className="j-input" style={{ width: 60 }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#8b949e', cursor: 'pointer' }}>
                  Web search
                  <input type="checkbox" checked={webSearch} onChange={e => setWebSearch(e.target.checked)} style={{ accentColor: '#58a6ff' }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#8b949e', cursor: 'pointer' }}>
                  Save to memory
                  <input type="checkbox" checked={saveMemory} onChange={e => setSaveMemory(e.target.checked)} style={{ accentColor: '#58a6ff' }} />
                </label>
              </div>
            )}

            <button
              onClick={run}
              disabled={!query.trim() || loading}
              className="j-btn j-btn-primary"
              style={{ width: '100%', height: 40 }}
            >
              {loading ? '⟳ Running…' : '▶ Run Research'}
            </button>
          </div>
        </div>

        {/* Right panel — results */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden', minWidth: 0 }}>
          {!result && !loading && (
            <div className="j-empty" style={{ flex: 1 }}>
              <span style={{ fontSize: 20 }}>⚗</span>
              Results will appear here
            </div>
          )}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="j-skeleton" style={{ height: 20, width: `${85 - i * 8}%` }} />
              ))}
            </div>
          )}
          {result && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
              {/* Trace (collapsible) */}
              {trace.length > 0 && (
                <div className="j-card" style={{ flexShrink: 0 }}>
                  <button
                    onClick={() => setShowTrace(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#8b949e', fontSize: 12, cursor: 'pointer', padding: 0 }}
                  >
                    {showTrace ? <ChevronDown style={{ width: 13, height: 13 }} /> : <ChevronRight style={{ width: 13, height: 13 }} />}
                    Tool trace ({trace.length} calls)
                  </button>
                  {showTrace && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {trace.map((t, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#8b949e' }}>
                          <span style={{ color: '#58a6ff', flexShrink: 0 }}>{t.tool}</span>
                          <span>→</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.result}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Result content */}
              <div className="j-card" style={{ flex: 1, overflow: 'auto' }} >
                <div className="j-prose" dangerouslySetInnerHTML={{ __html: marked.parse(result) as string }} />
              </div>

              {/* Footer */}
              {meta && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: 8, flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#484f58' }}>
                    {meta.model && <span>{meta.model}</span>}
                    {meta.latencyMs !== undefined && <><span>·</span><span>{meta.latencyMs}ms</span></>}
                    {meta.tokens !== undefined && <><span>·</span><span>{meta.tokens} tok</span></>}
                    {meta.costUsd !== undefined && <><span>·</span><span>${meta.costUsd.toFixed(4)}</span></>}
                    {meta.energyWh !== undefined && <><span>·</span><span>{meta.energyWh.toFixed(3)} Wh</span></>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!saveMemory && <button className="j-btn" style={{ height: 28, fontSize: 11 }}><Save style={{ width: 12, height: 12 }} /> Save</button>}
                    <button onClick={() => navigator.clipboard.writeText(result)} className="j-btn" style={{ height: 28, fontSize: 11 }}>
                      <Copy style={{ width: 12, height: 12 }} /> Copy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
