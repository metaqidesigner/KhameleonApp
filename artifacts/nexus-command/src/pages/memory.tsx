import React, { useState } from 'react';
import { Play, BrainCircuit, Search } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { useMemorySearch, useIndexMemory } from '@/hooks/useJarvis';

export default function Memory() {
  const [path, setPath]     = useState('');
  const [indexed, setIndexed] = useState<{ ok:boolean; chunks?:number }|null>(null);
  const [searchQ, setSearchQ] = useState('');
  const { mutateAsync: indexPath, isPending: indexing } = useIndexMemory();
  const { data: results, isFetching: searching } = useMemorySearch(searchQ);

  const doIndex = async () => {
    if (!path.trim()) return;
    const r = await indexPath(path.trim());
    setIndexed(r);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6, height:'100%', padding:8 }}>
      {/* MEMORY INDEX CONTROL */}
      <div style={{ flexShrink:0 }}>
        <JPanel title="MEMORY INDEX CONTROL" icon={<BrainCircuit size={13}/>}>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input className="j-input" style={{ flex:1 }} placeholder="/path/to/documents  or  ~/notes" value={path} onChange={e => setPath(e.target.value)} onKeyDown={e => e.key==='Enter' && doIndex()} />
              <button className="j-btn-primary" style={{ height:34, padding:'0 16px', fontSize:11 }} onClick={doIndex} disabled={indexing || !path.trim()}>
                {indexing ? <div style={{ width:10, height:10, border:'1.5px solid rgba(255,255,255,0.3)', borderTop:'1.5px solid #fff', borderRadius:'50%', animation:'jarvis-spin 0.7s linear infinite' }}/> : <Play size={12}/>}
                ▶ INDEX
              </button>
            </div>
            {indexed && (
              <div style={{ fontFamily:'var(--j-font-mono)', fontSize:10, color: indexed.ok ? 'var(--j-green)' : 'var(--j-red)', animation:'jarvis-fadein 0.2s ease both' }}>
                {indexed.ok ? `● INDEXED SUCCESSFULLY — ${indexed.chunks ?? '?'} CHUNKS STORED` : '✕ INDEX FAILED'}
              </div>
            )}
            <div style={{ fontFamily:'var(--j-font-mono)', fontSize:10, color:'var(--j-text-muted)', display:'flex', gap:16 }}>
              <span>0 CHUNKS</span>
              <span>0 SOURCES</span>
              <span>0.00 MB</span>
              <span>NEVER INDEXED</span>
            </div>
          </div>
        </JPanel>
      </div>

      {/* MEMORY RETRIEVAL */}
      <div style={{ flex:1, minHeight:0 }}>
        <JPanel title="MEMORY RETRIEVAL" icon={<Search size={13}/>}>
          <div style={{ display:'flex', flexDirection:'column', gap:12, height:'100%' }}>
            <input
              className="j-input"
              style={{ fontFamily:'var(--j-font-head)', fontSize:13, letterSpacing:'0.04em', height:40 }}
              placeholder="SEARCH INDEXED MEMORY..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            {searching && (
              <div style={{ display:'flex', alignItems:'center', gap:8, fontFamily:'var(--j-font-mono)', fontSize:10, color:'var(--j-text-muted)' }}>
                <div style={{ width:10, height:10, border:'1.5px solid rgba(0,212,255,0.2)', borderTop:'1.5px solid var(--j-cyan)', borderRadius:'50%', animation:'jarvis-spin 0.7s linear infinite' }}/>
                SCANNING MEMORY...
              </div>
            )}
            <div className="scrollbar-jarvis" style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:0 }}>
              {!results?.length && !searching && searchQ.length > 2 && (
                <div className="j-empty">NO RESULTS — TRY A DIFFERENT QUERY</div>
              )}
              {results?.map(r => (
                <div key={r.chunk_id} style={{ padding:'10px 0', borderBottom:'1px solid rgba(0,212,255,0.08)', animation:'jarvis-fadein 0.25s ease both' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <span className="j-mono" style={{ fontSize:10, color:'var(--j-cyan)' }}>{r.source}</span>
                    <span className="j-mono" style={{ fontSize:10, color:'var(--j-green)' }}>{(r.score * 100).toFixed(0)}%</span>
                  </div>
                  <p style={{ fontFamily:'var(--j-font-ui)', fontSize:12, color:'var(--j-text)', lineHeight:1.5, WebkitLineClamp:3, display:'-webkit-box', WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                    {r.content}
                  </p>
                  <div className="j-rel-bar"><div className="j-rel-fill" style={{ width:`${r.score*100}%` }}/></div>
                  <div style={{ display:'flex', gap:12, marginTop:2 }}>
                    <span className="j-mono" style={{ fontSize:9, color:'var(--j-text-faint)' }}>{r.chunk_id}</span>
                    {r.ts && <span className="j-mono" style={{ fontSize:9, color:'var(--j-text-faint)' }}>{new Date(r.ts).toLocaleString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </JPanel>
      </div>
    </div>
  );
}
