import { useState } from 'react';
import { useMemorySearch, useIndexMemory } from '@/hooks/useJarvis';

export default function Memory() {
  const [searchQ, setSearchQ] = useState('');
  const [indexPath, setIndexPath] = useState('');
  const { data: results, isLoading: searching } = useMemorySearch(searchQ);
  const indexMutation = useIndexMemory();

  const handleIndex = () => {
    if (!indexPath.trim()) return;
    indexMutation.mutate(indexPath.trim());
  };

  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Memory</h1>
          <p>Local persistent knowledge base</p>
        </div>
      </div>
      <div className="j-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Index section */}
        <div className="j-card">
          <div className="j-card-header">Index a Path</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="j-input"
              value={indexPath}
              onChange={e => setIndexPath(e.target.value)}
              placeholder="/path/to/documents or ~/notes"
              onKeyDown={e => e.key === 'Enter' && handleIndex()}
            />
            <button
              onClick={handleIndex}
              disabled={!indexPath.trim() || indexMutation.isPending}
              className="j-btn j-btn-primary"
              style={{ flexShrink: 0 }}
            >
              {indexMutation.isPending ? 'Indexing…' : 'Index'}
            </button>
          </div>
          {indexMutation.isSuccess && (
            <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#3fb950' }}>
              ✓ Indexed {(indexMutation.data as { ok: boolean; chunks?: number })?.chunks ?? 0} chunks from {indexPath}
            </div>
          )}
          {indexMutation.isError && (
            <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'var(--font-mono)', color: '#f85149' }}>
              ✗ Index failed — check path and backend connection
            </div>
          )}
        </div>

        {/* Search section */}
        <div>
          <input
            className="j-input"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search your indexed knowledge..."
            style={{ height: 44, fontSize: 14 }}
          />
        </div>

        {/* Results */}
        {searchQ.length > 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {searching ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="j-skeleton" style={{ height: 80 }} />
              ))
            ) : results?.length === 0 ? (
              <div className="j-empty">
                No results. Try searching for something in your indexed documents.
              </div>
            ) : (
              results?.map((r, i) => (
                <div key={i} className="j-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#58a6ff' }}>{r.source}</span>
                  <p style={{ fontSize: 13, color: '#8b949e', margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {r.content}
                  </p>
                  <div className="j-relevance-bar">
                    <div className="j-relevance-fill" style={{ width: `${Math.round(r.score * 100)}%` }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#484f58' }}>
                    {r.ts && <span>{new Date(r.ts).toLocaleString()}</span>}
                    {r.chunk_id && <span>{r.chunk_id}</span>}
                    <span style={{ marginLeft: 'auto' }}>{Math.round(r.score * 100)}% relevance</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {searchQ.length <= 2 && searchQ.length > 0 && (
          <p style={{ fontSize: 12, color: '#484f58', fontFamily: 'var(--font-mono)' }}>Type at least 3 characters to search…</p>
        )}
      </div>
    </div>
  );
}
