import React, { useState, useEffect, useCallback } from 'react';
import { Play, BrainCircuit, Search, MessageSquare, RefreshCw, ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import JPanel from '@/components/JPanel';
import { useMemorySearch, useIndexMemory } from '@/hooks/useJarvis';
import { getAgentConversations, type AgentConversationRow } from '@/lib/agentsApi';

// ── Agent History section ─────────────────────────────────────

interface Session {
  sessionId: string;
  agentId: string;
  rows: AgentConversationRow[];
  firstTs: string;
}

function groupSessions(rows: AgentConversationRow[]): Session[] {
  const map = new Map<string, Session>();
  for (const row of rows) {
    const key = row.sessionId;
    if (!map.has(key)) {
      map.set(key, { sessionId: key, agentId: row.agentId, rows: [], firstTs: row.createdAt });
    }
    map.get(key)!.rows.push(row);
  }
  // Sort sessions newest first
  return [...map.values()].sort((a, b) => new Date(b.firstTs).getTime() - new Date(a.firstTs).getTime());
}

function RoleTag({ role }: { role: AgentConversationRow['role'] }) {
  const colors: Record<AgentConversationRow['role'], string> = {
    user:        'rgba(192,21,42,0.6)',
    assistant:   'rgba(0,212,255,0.6)',
    tool_use:    '#c9a84c',
    tool_result: 'var(--j-green)',
  };
  const labels: Record<AgentConversationRow['role'], string> = {
    user: 'USR', assistant: 'AST', tool_use: 'TOOL', tool_result: 'RSLT',
  };
  return (
    <span className="j-mono" style={{ fontSize: 8, color: colors[role], border: `1px solid ${colors[role]}`, padding: '1px 5px', flexShrink: 0 }}>
      {labels[role]}
    </span>
  );
}

function SessionItem({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const ts    = new Date(session.firstTs);
  const label = ts.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const userRow = session.rows.find(r => r.role === 'user');
  const hasTool = session.rows.some(r => r.role === 'tool_use');
  const preview = userRow?.content.slice(0, 80) ?? '(no content)';

  return (
    <div style={{ borderBottom: '1px solid rgba(0,212,255,0.07)' }}>
      {/* Session header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', cursor: 'pointer', userSelect: 'none' }}
      >
        {open ? <ChevronDown size={10} style={{ flexShrink: 0, color: 'var(--j-cyan)' }} /> : <ChevronRight size={10} style={{ flexShrink: 0, color: 'var(--j-text-faint)' }} />}
        <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', flexShrink: 0 }}>{label}</span>
        <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-cyan)', flexShrink: 0, textTransform: 'uppercase' }}>{session.agentId}</span>
        {hasTool && <Wrench size={8} style={{ color: '#c9a84c', flexShrink: 0 }} />}
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {preview}{preview.length >= 80 ? '…' : ''}
        </span>
        <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', flexShrink: 0 }}>{session.rows.length} rows</span>
      </div>

      {/* Session rows */}
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 16, paddingBottom: 8 }}>
          {session.rows.map(row => (
            <div key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <RoleTag role={row.role} />
              {row.toolName && (
                <span className="j-mono" style={{ fontSize: 8, color: '#c9a84c', flexShrink: 0 }}>{row.toolName}</span>
              )}
              <span style={{
                fontFamily: row.role === 'user' ? 'var(--j-font-ui)' : 'var(--j-font-mono)',
                fontSize: 10, color: 'var(--j-text)', lineHeight: 1.55,
                display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                wordBreak: 'break-word', flex: 1,
              }}>
                {row.content.slice(0, 600)}{row.content.length > 600 ? '…' : ''}
              </span>
              {row.latencyMs != null && (
                <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)', flexShrink: 0 }}>{row.latencyMs}ms</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentHistory() {
  const [rows,     setRows]     = useState<AgentConversationRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [agentFilter, setAgentFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAgentConversations({ agentId: agentFilter || undefined, limit: 200 });
      setRows(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, [agentFilter]);

  useEffect(() => { load(); }, [load]);

  const sessions = groupSessions(rows);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <input
          className="j-input"
          style={{ flex: 1, height: 28, fontSize: 10 }}
          placeholder="Filter by agent ID (e.g. claude)…"
          value={agentFilter}
          onChange={e => setAgentFilter(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()}
        />
        <button
          className="j-btn-ghost"
          style={{ height: 28, width: 28, padding: 0, flexShrink: 0 }}
          onClick={load}
          title="Refresh"
        >
          <RefreshCw size={11} style={{ animation: loading ? 'jarvis-spin 0.7s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Session list */}
      <div className="scrollbar-jarvis" style={{ flex: 1, overflowY: 'auto' }}>
        {sessions.length === 0 && !loading && (
          <div className="j-empty">
            {rows.length === 0
              ? 'NO CONVERSATION HISTORY YET — CHAT WITH AN AGENT TO SEE SESSIONS HERE'
              : 'NO SESSIONS MATCH FILTER'}
          </div>
        )}
        {sessions.map(s => <SessionItem key={s.sessionId} session={s} />)}
      </div>

      {/* Footer */}
      <div className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)', flexShrink: 0, display: 'flex', gap: 16 }}>
        <span>{sessions.length} SESSIONS</span>
        <span>{rows.length} ROWS</span>
        <span>{rows.filter(r => r.role === 'tool_use').length} TOOL CALLS</span>
      </div>
    </div>
  );
}

// ── Main Memory page ──────────────────────────────────────────

export default function Memory() {
  const [path, setPath]       = useState('');
  const [indexed, setIndexed] = useState<{ ok: boolean; chunks?: number } | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const { mutateAsync: indexPath, isPending: indexing } = useIndexMemory();
  const { data: results, isFetching: searching } = useMemorySearch(searchQ);

  const doIndex = async () => {
    if (!path.trim()) return;
    const r = await indexPath(path.trim());
    setIndexed(r);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', padding: 8 }}>

      {/* ── MEMORY INDEX CONTROL (fixed height) ── */}
      <div style={{ flexShrink: 0 }}>
        <JPanel title="MEMORY INDEX CONTROL" icon={<BrainCircuit size={13} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="j-input"
                style={{ flex: 1 }}
                placeholder="/path/to/documents  or  ~/notes"
                value={path}
                onChange={e => setPath(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doIndex()}
              />
              <button
                className="j-btn-primary"
                style={{ height: 34, padding: '0 16px', fontSize: 11 }}
                onClick={doIndex}
                disabled={indexing || !path.trim()}
              >
                {indexing
                  ? <div style={{ width: 10, height: 10, border: '1.5px solid rgba(255,255,255,0.3)', borderTop: '1.5px solid #fff', borderRadius: '50%', animation: 'jarvis-spin 0.7s linear infinite' }} />
                  : <Play size={12} />}
                ▶ INDEX
              </button>
            </div>
            {indexed && (
              <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 10, color: indexed.ok ? 'var(--j-green)' : 'var(--j-red)', animation: 'jarvis-fadein 0.2s ease both' }}>
                {indexed.ok ? `● INDEXED SUCCESSFULLY — ${indexed.chunks ?? '?'} CHUNKS STORED` : '✕ INDEX FAILED'}
              </div>
            )}
            <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'var(--j-text-muted)', display: 'flex', gap: 16 }}>
              <span>0 CHUNKS</span><span>0 SOURCES</span><span>0.00 MB</span><span>NEVER INDEXED</span>
            </div>
          </div>
        </JPanel>
      </div>

      {/* ── AGENT HISTORY + MEMORY RETRIEVAL split ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* Agent History (top half) */}
        <div style={{ flex: '1 1 50%', minHeight: 0 }}>
          <JPanel title="AGENT HISTORY" icon={<MessageSquare size={13} />}>
            <AgentHistory />
          </JPanel>
        </div>

        {/* Memory Retrieval (bottom half) */}
        <div style={{ flex: '1 1 50%', minHeight: 0 }}>
          <JPanel title="MEMORY RETRIEVAL" icon={<Search size={13} />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
              <input
                className="j-input"
                style={{ fontFamily: 'var(--j-font-ui)', fontSize: 13, letterSpacing: '0.04em', height: 40, flexShrink: 0 }}
                placeholder="SEARCH INDEXED MEMORY..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              {searching && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'var(--j-text-muted)' }}>
                  <div style={{ width: 10, height: 10, border: '1.5px solid rgba(0,212,255,0.2)', borderTop: '1.5px solid var(--j-cyan)', borderRadius: '50%', animation: 'jarvis-spin 0.7s linear infinite' }} />
                  SCANNING MEMORY...
                </div>
              )}
              <div className="scrollbar-jarvis" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {!results?.length && !searching && searchQ.length > 2 && (
                  <div className="j-empty">NO RESULTS — TRY A DIFFERENT QUERY</div>
                )}
                {results?.map(r => (
                  <div key={r.chunk_id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,212,255,0.08)', animation: 'jarvis-fadein 0.25s ease both' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span className="j-mono" style={{ fontSize: 10, color: 'var(--j-cyan)' }}>{r.source}</span>
                      <span className="j-mono" style={{ fontSize: 10, color: 'var(--j-green)' }}>{(r.score * 100).toFixed(0)}%</span>
                    </div>
                    <p style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: 'var(--j-text)', lineHeight: 1.5, WebkitLineClamp: 3, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {r.content}
                    </p>
                    <div className="j-rel-bar"><div className="j-rel-fill" style={{ width: `${r.score * 100}%` }} /></div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                      <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)' }}>{r.chunk_id}</span>
                      {r.ts && <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)' }}>{new Date(r.ts).toLocaleString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </JPanel>
        </div>
      </div>
    </div>
  );
}
