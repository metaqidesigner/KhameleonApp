import { useState } from 'react';
import { BrainCircuit, Search, FolderOpen, Star, FileText } from 'lucide-react';
import { useMemorySearch, useIndexMemory } from '@/hooks/useJarvis';

export default function Memory() {
  const [searchQ, setSearchQ] = useState('');
  const [indexPath, setIndexPath] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const { data: results, isLoading: searching } = useMemorySearch(debouncedQ);
  const { mutate: indexPath_, isPending: indexing } = useIndexMemory();

  const handleSearchChange = (v: string) => {
    setSearchQ(v);
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => setDebouncedQ(v), 400);
    setTimer(t);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#a855f7', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Memory</h2>
        <p style={{ fontSize: 12, color: 'rgba(130,170,200,0.55)', lineHeight: 1.5 }}>Search your indexed knowledge base or add new documents for Jarvis to remember.</p>
      </div>

      {/* Search */}
      <div className="nexus-card" style={{ padding: 18 }}>
        <div style={{ fontSize: 11, color: 'rgba(168,85,247,0.7)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Search style={{ width: 12, height: 12 }} /> Search Memory
        </div>
        <input className="nexus-input" value={searchQ} onChange={e => handleSearchChange(e.target.value)} placeholder="Type at least 3 chars to search your knowledge base…" />
      </div>

      {/* Results */}
      {debouncedQ.length > 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 10, color: 'rgba(130,170,200,0.45)', letterSpacing: '0.12em', fontWeight: 600, textTransform: 'uppercase' }}>
            {searching ? 'Searching…' : `${(results ?? []).length} results for "${debouncedQ}"`}
          </div>
          {searching ? (
            Array.from({ length: 3 }).map((_, i) => <div key={i} className="nexus-card nexus-shimmer" style={{ height: 80 }} />)
          ) : (
            (results ?? []).map((r, i) => (
              <div key={i} className="nexus-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <FileText style={{ width: 14, height: 14, color: '#a855f7', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'rgba(210,235,250,0.9)', lineHeight: 1.5, marginBottom: 8 }}>{r.content}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10, color: 'rgba(0,212,255,0.45)', fontFamily: 'var(--font-mono)' }}>{r.source}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Star style={{ width: 10, height: 10, color: '#c9a84c' }} />
                        <span style={{ fontSize: 10, color: '#c9a84c', fontFamily: 'var(--font-mono)' }}>{(r.score * 100).toFixed(0)}% match</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {!searching && (results ?? []).length === 0 && (
            <div style={{ textAlign: 'center', color: 'rgba(130,170,200,0.4)', fontSize: 12, padding: '20px 0' }}>No results found. Try indexing a path first.</div>
          )}
        </div>
      )}

      {/* Index path */}
      <div className="nexus-card" style={{ padding: 18 }}>
        <div style={{ fontSize: 11, color: 'rgba(168,85,247,0.7)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
          <FolderOpen style={{ width: 12, height: 12 }} /> Index a Path
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="nexus-input" value={indexPath} onChange={e => setIndexPath(e.target.value)} onKeyDown={e => e.key === 'Enter' && indexPath_(indexPath)} placeholder="/path/to/documents or ~/notes" />
          <button className="nexus-btn" onClick={() => indexPath_(indexPath)} disabled={indexing || !indexPath.trim()}
            style={{ flexShrink: 0, borderColor: 'rgba(168,85,247,0.4)', color: '#a855f7', background: 'rgba(168,85,247,0.1)' }}>
            <BrainCircuit style={{ width: 13, height: 13 }} /> {indexing ? 'Indexing…' : 'Index'}
          </button>
        </div>
      </div>
    </div>
  );
}
