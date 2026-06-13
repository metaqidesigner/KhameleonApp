import { useState } from 'react';
import { useJarvisHealth, useJarvisTelemetry, useJarvisConnectors, useAskJarvis } from '@/hooks/useJarvis';
import { useJarvisStore } from '@/store/jarvisStore';

function fmt(v: number | undefined, d = 0, suf = '') {
  if (v === undefined || v === null) return '—';
  return v.toFixed(d) + suf;
}
function fmtUptime(s: number) {
  if (!s) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Dashboard() {
  const { data: health, isLoading: hLoading } = useJarvisHealth();
  const { data: telemetry } = useJarvisTelemetry();
  const { data: connectors } = useJarvisConnectors();
  const askJarvis = useAskJarvis();
  const { agentHistory, setActiveModule } = useJarvisStore();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [diagResult, setDiagResult] = useState<string | null>(null);

  const isOnline = health?.status === 'online';
  const offline = !hLoading && !isOnline;

  const statCards = [
    { label: 'TOTAL QUERIES', value: fmt((health?.total_queries ?? 0) + agentHistory.length, 0) },
    { label: 'AVG LATENCY',   value: fmt(health?.avg_latency_ms, 0, 'ms') },
    { label: 'TOTAL COST',    value: `$${fmt(health?.total_cost_usd, 4)}` },
    { label: 'ENERGY USED',   value: fmt(telemetry?.energy_wh, 2, ' Wh') },
  ];

  const systemRows: [string, string][] = [
    ['Engine',     health?.engine ?? '—'],
    ['Model',      health?.model ?? '—'],
    ['GPU',        health?.gpu ?? '—'],
    ['VRAM',       health?.vram_gb ? `${health.vram_gb} GB` : '—'],
    ['Uptime',     health?.uptime ? fmtUptime(health.uptime) : '—'],
    ['tok/s',      fmt(health?.tokens_per_sec, 1)],
    ['Watt/query', fmt(health?.watt_per_query, 2, ' W')],
  ];

  return (
    <div className="j-page">
      <div className="j-page-header">
        <div>
          <h1>Dashboard</h1>
          <p>System overview and recent activity</p>
        </div>
        {offline && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#f85149', fontFamily: 'var(--font-mono)' }}>
            <span>● backend offline —</span>
            <code style={{ fontSize: 11, background: '#21262d', border: '1px solid #30363d', borderRadius: 3, padding: '1px 6px' }}>jarvis serve</code>
          </div>
        )}
      </div>

      <div className="j-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Stat cards */}
        <div className="j-grid-4">
          {statCards.map(s => (
            <div key={s.label} className="j-stat-card">
              <div className="j-stat-value">{s.value}</div>
              <div className="j-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* System + Agent Activity */}
        <div className="j-grid-2">
          <div className="j-card">
            <div className="j-card-header">System</div>
            <table className="j-table">
              <tbody>
                {systemRows.map(([k, v]) => (
                  <tr key={k}>
                    <td style={{ color: '#8b949e', fontFamily: 'var(--font-mono)', fontSize: 12, width: 110 }}>{k}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="j-card">
            <div className="j-card-header">Agent Activity</div>
            {agentHistory.length === 0 ? (
              <div className="j-empty" style={{ padding: '24px 12px' }}>
                No activity yet — use Chat or ⌘K to ask Jarvis
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {agentHistory.slice(0, 10).map(ev => (
                  <div key={ev.id}>
                    <button
                      onClick={() => setExpandedRow(expandedRow === ev.id ? null : ev.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 0', background: 'none', border: 'none',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#484f58', flexShrink: 0 }}>
                        {new Date(ev.ts).toLocaleTimeString()}
                      </span>
                      <span className="j-badge j-badge-purple" style={{ flexShrink: 0 }}>{ev.agent}</span>
                      <span style={{ fontSize: 12, color: '#8b949e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.prompt.slice(0, 55)}{ev.prompt.length > 55 ? '…' : ''}
                      </span>
                    </button>
                    {expandedRow === ev.id && (
                      <div style={{ padding: '6px 0 8px 12px', fontSize: 12, color: '#8b949e', borderLeft: '2px solid #30363d', marginLeft: 90 }}>
                        {ev.response.slice(0, 300)}{ev.response.length > 300 ? '…' : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Connectors + Quick Actions */}
        <div className="j-grid-2">
          <div className="j-card">
            <div className="j-card-header">Connected Sources</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(connectors ?? []).slice(0, 12).map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px', borderRadius: 4,
                  background: '#0d1117', border: '1px solid #30363d',
                }}>
                  <span style={{ flex: 1, fontSize: 12, color: '#e6edf3' }}>{c.name}</span>
                  {c.connected
                    ? <span className="j-badge j-badge-green">●</span>
                    : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#484f58' }}>—</span>
                  }
                </div>
              ))}
            </div>
          </div>

          <div className="j-card">
            <div className="j-card-header">Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: '▶  Morning Digest',  action: () => { askJarvis.mutate({ prompt: 'Give me my morning digest', agent: 'morning_digest' }); setActiveModule('chat'); } },
                { label: '▶  Deep Research',    action: () => setActiveModule('research') },
                { label: '▶  Memory Index',     action: () => setActiveModule('memory') },
                { label: diagResult ? '✓  Diagnostics run' : '▶  Run Diagnostics', action: () => {
                  setDiagResult(health ? JSON.stringify({ status: health.status, engine: health.engine, model: health.model, uptime: health.uptime }, null, 2) : '— offline');
                }},
              ].map(btn => (
                <button
                  key={btn.label}
                  onClick={btn.action}
                  className="j-btn"
                  style={{ width: '100%', justifyContent: 'flex-start', height: 36, background: '#21262d' }}
                >
                  {btn.label}
                </button>
              ))}
              {diagResult && (
                <pre style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  background: '#0d1117', border: '1px solid #30363d',
                  borderRadius: 4, padding: 10, margin: 0, color: '#8b949e',
                }}>
                  {diagResult}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
