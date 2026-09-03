import React, { useState, useRef } from 'react';
import { marked } from 'marked';
import { Play, Copy, ChevronDown, ChevronRight, FlaskConical } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { runResearch } from '@/lib/jarvisApi';

interface ResearchToolResult {
  name: string;
  input: Record<string, unknown>;
  result: string;
  durationMs: number;
  error?: string;
}

interface ResearchResult {
  content: string;
  model?: string | null;
  latencyMs?: number;
  tokens?: number;
  cost?: number;
  toolResults: ResearchToolResult[];
}

export default function Research() {
  const [query, setQuery]       = useState('');
  const [maxIter, setMaxIter]   = useState(3);
  const [webSearch, setWebSearch] = useState(true);
  const [saveMemory, setSaveMemory] = useState(false);
  const [optOpen, setOptOpen]   = useState(false);
  const [running, setRunning]   = useState(false);
  const [result, setResult]     = useState<ResearchResult | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [copied, setCopied]     = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const run = async () => {
    if (!query.trim() || running) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await runResearch(query, { max_iterations: maxIter, web_search: webSearch });
      setResult({
        content: res.content, model: res.model, latencyMs: res.latency_ms, tokens: res.tokens, cost: res.cost_usd,
        toolResults: (res.tool_results ?? []) as ResearchToolResult[],
      });
    } finally {
      setRunning(false);
    }
  };

  const copy = () => { navigator.clipboard.writeText(result?.content ?? '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'35% 65%', gap:6, height:'100%', padding:8 }}>
      {/* RESEARCH QUERY */}
      <JPanel title="RESEARCH QUERY" icon={<FlaskConical size={13}/>}>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <label style={{ fontFamily:'var(--j-font-ui)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.18em', color:'var(--j-text-muted)' }}>RESEARCH QUERY</label>
          <textarea
            className="j-textarea"
            rows={6}
            placeholder="Enter research query..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />

          {/* Options */}
          <div>
            <button
              onClick={() => setOptOpen(v => !v)}
              style={{ display:'flex', alignItems:'center', gap:6, border:'none', cursor:'pointer', width:'100%', padding:'6px 10px', background:'linear-gradient(90deg, rgba(107,0,0,0.4), transparent)', borderBottom:'1px solid rgba(192,21,42,0.3)' }}
            >
              {optOpen ? <ChevronDown size={12} color="var(--j-red)"/> : <ChevronRight size={12} color="var(--j-red)"/>}
              <span style={{ fontFamily:'var(--j-font-ui)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.18em', color:'var(--j-text-muted)' }}>OPTIONS</span>
            </button>
            {optOpen && (
              <div style={{ padding:'10px 0', display:'flex', flexDirection:'column', gap:10, animation:'jarvis-fadein 0.2s ease both' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <label style={{ fontFamily:'var(--j-font-ui)', fontSize:11, color:'var(--j-text-muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>MAX ITERATIONS</label>
                  <input type="number" min={1} max={10} value={maxIter} onChange={e => setMaxIter(Number(e.target.value))} className="j-input" style={{ width:60 }}/>
                </div>
                {[
                  { label:'WEB SEARCH', val:webSearch, set:setWebSearch },
                  { label:'SAVE TO MEMORY', val:saveMemory, set:setSaveMemory },
                ].map(({ label, val, set }) => (
                  <div key={label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <label style={{ fontFamily:'var(--j-font-ui)', fontSize:11, color:'var(--j-text-muted)', textTransform:'uppercase', letterSpacing:'0.1em' }}>{label}</label>
                    <button onClick={() => set(v => !v)} style={{ width:36, height:18, background: val ? 'rgba(0,212,255,0.2)' : 'rgba(0,0,0,0.5)', border:`1px solid ${val ? 'var(--j-cyan)' : 'rgba(0,212,255,0.2)'}`, cursor:'pointer', borderRadius:0, position:'relative' }}>
                      <span style={{ position:'absolute', top:2, left: val ? '50%' : 2, width:12, height:12, background: val ? 'var(--j-cyan)' : 'var(--j-text-faint)', transition:'left 0.15s' }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className="j-btn-primary"
            style={{ width:'100%' }}
            onClick={run}
            disabled={running || !query.trim()}
          >
            {running ? (
              <><div style={{ width:12, height:12, border:'1.5px solid rgba(255,255,255,0.3)', borderTop:'1.5px solid #fff', borderRadius:'50%', animation:'jarvis-spin 0.7s linear infinite' }} />PROCESSING...</>
            ) : (
              <><Play size={14}/>▶ INITIATE RESEARCH</>
            )}
          </button>
        </div>
      </JPanel>

      {/* RESEARCH OUTPUT */}
      <JPanel title={result ? `RESEARCH OUTPUT — ${query.slice(0,40)}${query.length>40?'…':''}` : 'RESEARCH OUTPUT'} icon={<FlaskConical size={13}/>} badge="DEEP_RESEARCH">
        {!result && !running && (
          <div className="j-empty" style={{ height:'80%' }}>
            <div style={{ position:'relative', width:80, height:80 }}>
              {[40,32,22].map((r,i) => (
                <svg key={i} style={{ position:'absolute', inset:0 }} width={80} height={80}>
                  <circle cx={40} cy={40} r={r} fill="none" stroke="rgba(0,212,255,0.2)" strokeWidth={1} strokeDasharray={i===0?undefined:`${r*0.5} ${r*0.3}`} style={{ animation:`jarvis-spin${i===1?'-r':''} ${12+i*4}s linear infinite` }} />
                </svg>
              ))}
            </div>
            AWAITING QUERY
          </div>
        )}
        {running && (
          <div className="j-empty" style={{ height:'80%' }}>
            <div style={{ width:12, height:12, border:'2px solid rgba(0,212,255,0.3)', borderTop:'2px solid var(--j-cyan)', borderRadius:'50%', animation:'jarvis-spin 0.8s linear infinite' }} />
            PROCESSING RESEARCH QUERY...
            <div style={{ fontFamily:'var(--j-font-mono)', fontSize:10, color:'var(--j-text-faint)', animation:'jarvis-pulse 1.5s ease-in-out infinite' }}>SCANNING WEB SOURCES · SYNTHESISING RESULTS</div>
          </div>
        )}
        {result && (
          <div style={{ display:'flex', flexDirection:'column', gap:10, height:'100%' }}>
            {/* Trace log — real tool calls made during this run, not a fixed decorative script */}
            <div>
              <button onClick={() => setTraceOpen(v=>!v)} style={{ display:'flex', alignItems:'center', gap:6, width:'100%', padding:'5px 10px', background:'linear-gradient(90deg, rgba(107,0,0,0.4), transparent)', border:'none', borderBottom:'1px solid rgba(192,21,42,0.3)', cursor:'pointer' }}>
                {traceOpen ? <ChevronDown size={11} color="var(--j-red)"/> : <ChevronRight size={11} color="var(--j-red)"/>}
                <span style={{ fontFamily:'var(--j-font-ui)', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.18em', color:'var(--j-text-muted)' }}>
                  TRACE LOG {result.toolResults.length > 0 && `(${result.toolResults.length})`}
                </span>
              </button>
              {traceOpen && (
                <div style={{ padding:'6px 0', fontFamily:'var(--j-font-mono)', fontSize:10, color:'var(--j-text-muted)', animation:'jarvis-fadein 0.15s ease both' }}>
                  {result.toolResults.length === 0 ? (
                    <span>No tool calls — answered from the model's own knowledge.</span>
                  ) : (
                    result.toolResults.map((t, i) => (
                      <div key={i} style={{ color: t.error ? 'var(--j-red)' : 'var(--j-text-muted)' }}>
                        → {t.name}({Object.values(t.input).map(String).join(', ')}) : {t.error ?? `${t.result.length} chars`} · {t.durationMs}ms
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Markdown */}
            <div ref={resultRef} className="j-prose scrollbar-jarvis" style={{ flex:1, overflowY:'auto' }}
              dangerouslySetInnerHTML={{ __html: marked.parse(result.content) as string }}
            />

            {/* Footer */}
            {result.model && (
              <div style={{ fontFamily:'var(--j-font-mono)', fontSize:10, color:'var(--j-text-muted)', borderTop:'1px solid rgba(0,212,255,0.1)', paddingTop:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>{result.model} · {result.latencyMs}ms · {result.tokens} tok · ${(result.cost??0).toFixed(4)}</span>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="j-btn-ghost" style={{ height:26, fontSize:10, padding:'0 10px' }} onClick={copy}>
                    <Copy size={11}/> {copied ? 'COPIED!' : 'COPY'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </JPanel>
    </div>
  );
}
