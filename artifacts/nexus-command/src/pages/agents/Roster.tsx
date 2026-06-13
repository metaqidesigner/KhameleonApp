import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import JPanel from '@/components/JPanel';
import {
  getRoster, getAgentStatus, getAgentMetrics,
  FALLBACK_ROSTER, PROVIDER_LABELS, STATUS_COLOR,
  type AgentConfig, type AgentStatusInfo, type AgentMetrics,
} from '@/lib/agentsApi';

interface AgentRowData {
  config: AgentConfig;
  status?: AgentStatusInfo;
  metrics?: AgentMetrics;
}

export default function Roster({ onSelectAgent }: { onSelectAgent?: (id: string) => void }) {
  const [rows, setRows] = useState<AgentRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const roster = await getRoster();
    setRows(roster.map(c => ({ config: c })));
    setLoading(false);
    // fetch status + metrics for each in background
    roster.forEach(async (c) => {
      const [status, metrics] = await Promise.all([
        getAgentStatus(c.id).catch(() => undefined),
        getAgentMetrics(c.id).catch(() => undefined),
      ]);
      setRows(prev => prev.map(r => r.config.id === c.id ? { ...r, status, metrics } : r));
    });
  }

  useEffect(() => { load(); }, []);

  const activeCount = rows.filter(r => r.status?.status === 'online').length;

  const selRow = rows.find(r => r.config.id === selected);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '38% 1fr', gap: 6, height: '100%', padding: 8 }}>
      {/* AGENT ROSTER */}
      <JPanel
        title={`AGENT ROSTER — ${activeCount} ACTIVE`}
        badge={loading ? 'LOADING' : undefined}
        action={
          <button className="j-btn-ghost" style={{ height: 22, padding: '0 8px', fontSize: 9 }} onClick={load}>
            <RefreshCw size={10} />REFRESH
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {(loading ? FALLBACK_ROSTER : rows.map(r => r.config)).map(cfg => {
            const row   = rows.find(r => r.config.id === cfg.id);
            const st    = row?.status;
            const mx    = row?.metrics;
            const color = STATUS_COLOR[st?.status ?? 'standby'];
            const isSel = selected === cfg.id;

            return (
              <div
                key={cfg.id}
                onClick={() => setSelected(isSel ? null : cfg.id)}
                style={{
                  padding: '8px 10px',
                  background: isSel ? 'rgba(0,212,255,0.06)' : 'rgba(0,212,255,0.02)',
                  border: `1px solid ${isSel ? 'rgba(0,212,255,0.35)' : 'rgba(0,212,255,0.08)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* status dot */}
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
                  {/* avatar */}
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: cfg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--j-font-head)', fontSize: 11, fontWeight: 700, color: '#000', flexShrink: 0 }}>
                    {cfg.initials}
                  </div>
                  {/* name + model */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--j-font-head)', fontSize: 12, color: '#fff', letterSpacing: '0.08em' }}>{cfg.name}</span>
                      <span className="j-badge" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: 'var(--j-text-muted)', fontSize: 8 }}>{PROVIDER_LABELS[cfg.provider]}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 }}>
                      <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-muted)' }}>{cfg.model}</span>
                      <span className="j-badge" style={{ fontSize: 8, color, borderColor: color, background: `${color}15` }}>{(st?.status ?? 'standby').toUpperCase()}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span className="j-badge" style={{ fontSize: 8, color: 'var(--j-text-muted)', border: '1px solid rgba(255,255,255,0.08)' }}>{cfg.role.toUpperCase()}</span>
                      {mx && mx.queries > 0 && (
                        <>
                          <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>{mx.avgLatencyMs}ms</span>
                          <span className="j-mono" style={{ fontSize: 8, color: 'var(--j-text-faint)' }}>${mx.totalCostUsd.toFixed(4)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <button
          className="j-btn-ghost"
          style={{ width: '100%', marginTop: 8, justifyContent: 'center', fontSize: 10 }}
          onClick={() => onSelectAgent?.('__new__')}
        >
          <Plus size={11} />ADD CUSTOM AGENT
        </button>
      </JPanel>

      {/* AGENT DETAIL */}
      <JPanel
        title={selRow ? `${selRow.config.name} — DETAILS` : 'AGENT DETAILS'}
        badge={selRow?.status?.status?.toUpperCase()}
      >
        {!selRow ? (
          <div className="j-empty">
            <div style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wifi size={20} color="var(--j-text-faint)" />
            </div>
            SELECT AN AGENT TO VIEW DETAILS
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 14px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.1)' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: selRow.config.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--j-font-head)', fontSize: 18, fontWeight: 700, color: '#000', flexShrink: 0 }}>
                {selRow.config.initials}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--j-font-head)', fontSize: 16, color: '#fff', letterSpacing: '0.1em' }}>{selRow.config.name}</div>
                <div className="j-mono" style={{ fontSize: 11, color: 'var(--j-text-muted)', marginTop: 3 }}>{selRow.config.model}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                  <span className="j-badge j-badge-cyan">{PROVIDER_LABELS[selRow.config.provider]}</span>
                  <span className="j-badge" style={{ color: 'var(--j-text-muted)', borderColor: 'rgba(255,255,255,0.1)' }}>{selRow.config.role.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { label: 'STATUS',     value: selRow.status?.status?.toUpperCase() ?? 'STANDBY' },
                { label: 'PROVIDER',   value: PROVIDER_LABELS[selRow.config.provider] },
                { label: 'MODEL',      value: selRow.config.model },
                { label: 'API KEY',    value: selRow.config.apiKey === 'SET' ? '●●●●●●●●' : selRow.config.apiKey === 'NOT SET' ? 'NOT SET' : 'MANAGED' },
              ].map(({ label, value }) => (
                <div key={label} className="j-metric">
                  <div className="j-metric-header">{label}</div>
                  <div className="j-metric-value" style={{ fontSize: 11 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* metrics */}
            {selRow.metrics && selRow.metrics.queries > 0 && (
              <div>
                <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-text-muted)', marginBottom: 6, letterSpacing: '0.06em' }}>PERFORMANCE METRICS</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
                  {[
                    { label: 'QUERIES',   value: String(selRow.metrics.queries) },
                    { label: 'AVG LAT',   value: `${selRow.metrics.avgLatencyMs}ms` },
                    { label: 'AVG TOK',   value: String(selRow.metrics.avgTokens) },
                    { label: 'COST',      value: `$${selRow.metrics.totalCostUsd.toFixed(4)}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="j-metric">
                      <div className="j-metric-header">{label}</div>
                      <div className="j-metric-value" style={{ fontSize: 11 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* system prompt */}
            <div>
              <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-text-muted)', marginBottom: 5, letterSpacing: '0.06em' }}>SYSTEM PROMPT</div>
              <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,212,255,0.08)', fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'var(--j-text)', lineHeight: 1.6 }}>
                {selRow.config.systemPrompt || '(none)'}
              </div>
            </div>

            {/* actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="j-btn-primary" style={{ flex: 1, height: 32, fontSize: 10 }} onClick={() => onSelectAgent?.(selRow.config.id)}>
                {selRow.status?.status === 'online' ? <Wifi size={12}/> : <WifiOff size={12}/>}
                OPEN CHAT
              </button>
            </div>
          </div>
        )}
      </JPanel>
    </div>
  );
}
