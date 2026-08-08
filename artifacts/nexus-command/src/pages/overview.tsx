import React, { useState } from 'react';
import GridLayoutRaw from 'react-grid-layout';
import {
  Play, Search, Database, Activity, Zap, Clock,
  DollarSign, Cpu, Radio, ArrowRight,
} from 'lucide-react';
import { useJarvisHealth, useJarvisTelemetry, useJarvisConnectors } from '@/hooks/useJarvis';
import { useJarvisStore, type PanelLayout } from '@/store/jarvisStore';
import JPanel from '@/components/JPanel';
import HUDRings from '@/components/HUDRings';
import { OFFLINE_HEALTH, MOCK_TELEMETRY } from '@/lib/jarvisApi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GridLayout = GridLayoutRaw as any;

const DEFAULT_LAYOUT: PanelLayout[] = [
  { i: 'system',   x: 0, y: 0,  w: 7, h: 12 },
  { i: 'activity', x: 7, y: 0,  w: 5, h: 12 },
  { i: 'sources',  x: 0, y: 12, w: 4, h: 10 },
  { i: 'actions',  x: 4, y: 12, w: 8, h: 10 },
];

function fmtMs(n?: number)     { return n != null ? `${n.toFixed(0)}ms`    : '—'; }
function fmtCost(n?: number)   { return n != null ? `$${n.toFixed(4)}`     : '—'; }
function fmtEnergy(n?: number) { return n != null ? `${n.toFixed(2)} Wh`   : '—'; }
function fmtUptime(s: number)  { return s ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : '—'; }

// ── Metric box ────────────────────────────────────────────────

function MetricBox({
  icon, label, value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      padding: '8px 10px',
      gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: 'rgba(196,212,236,0.35)', display: 'flex' }}>{icon}</span>
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 9, fontWeight: 600, color: 'rgba(196,212,236,0.45)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 17, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

// ── KV row ────────────────────────────────────────────────────

function KVRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <td style={{ padding: '7px 0', width: '42%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ color: 'rgba(196,212,236,0.28)', display: 'flex', flexShrink: 0 }}>{icon}</span>
          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: 'rgba(196,212,236,0.45)' }}>{label}</span>
        </div>
      </td>
      <td style={{ padding: '7px 0 7px 8px' }}>
        <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>
          — &nbsp; {value}
        </span>
      </td>
    </tr>
  );
}

export default function Overview() {
  const { data: health    = OFFLINE_HEALTH  }  = useJarvisHealth();
  const { data: telemetry = MOCK_TELEMETRY  }  = useJarvisTelemetry();
  const { data: connectors = []             }  = useJarvisConnectors();
  const setPanelLayout = useJarvisStore(s => s.setPanelLayout);
  const panelLayouts   = useJarvisStore(s => s.panelLayouts);
  const setChatOpen    = useJarvisStore(s => s.setChatOpen);
  const setActiveTab   = useJarvisStore(s => s.setActiveTab);
  const agentHistory   = useJarvisStore(s => s.agentHistory);
  const layout = (panelLayouts['overview'] ?? DEFAULT_LAYOUT) as PanelLayout[];

  const [width, setWidth] = useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const obs = new ResizeObserver(e => setWidth(e[0].contentRect.width));
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const isOnline = health.status !== 'offline';

  return (
    <div ref={containerRef} style={{ height: '100%', overflowY: 'auto', padding: 8 }} className="scrollbar-jarvis">
      {width > 0 && (
        <GridLayout
          layout={layout}
          cols={12}
          rowHeight={28}
          width={width - 16}
          draggableHandle=".j-panel-header"
          onLayoutChange={(l: PanelLayout[]) => setPanelLayout('overview', l)}
          margin={[8, 8]}
          containerPadding={[0, 0]}
        >
          {/* ── SYSTEM STATUS ── */}
          <div key="system">
            <JPanel title="System status" icon={<Activity size={13} />}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>

                {/* Gauge */}
                <HUDRings health={health} telemetry={telemetry} />

                {/* Metric boxes */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 7, width: '100%' }}>
                  <MetricBox icon={<Database size={10} />} label="Total queries" value={isOnline ? String(health.total_queries ?? 0) : '—'} />
                  <MetricBox icon={<Clock size={10} />}    label="Avg latency"   value={fmtMs(health.avg_latency_ms)} />
                  <MetricBox icon={<DollarSign size={10} />} label="Total cost"  value={fmtCost(health.total_cost_usd)} />
                  <MetricBox icon={<Zap size={10} />}      label="Energy"        value={fmtEnergy(telemetry.energy_wh)} />
                </div>

                {/* Key-value table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    <KVRow icon={<Cpu size={10} />}      label="Engine"  value={health.engine || 'none'} />
                    <KVRow icon={<Database size={10} />} label="Model"   value={health.model  || '—'} />
                    <KVRow icon={<Clock size={10} />}    label="Uptime"  value={fmtUptime(health.uptime ?? 0)} />
                  </tbody>
                </table>

                {/* Listening footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingTop: 2 }}>
                  <Activity size={11} style={{ color: isOnline ? 'var(--j-teal)' : 'rgba(196,212,236,0.25)', animation: isOnline ? 'jarvis-pulse 2.5s ease-in-out infinite' : undefined }} />
                  <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'rgba(196,212,236,0.32)', fontStyle: 'italic' }}>
                    Listening for 'Hello Khameleon'
                  </span>
                </div>
              </div>
            </JPanel>
          </div>

          {/* ── AGENT ACTIVITY ── */}
          <div key="activity">
            <JPanel title="Agent activity" icon={<Activity size={13} />} badge="LIVE">
              {agentHistory.length === 0 ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  height: '100%', gap: 14,
                  border: '1px dashed rgba(255,255,255,0.10)',
                  borderRadius: 10,
                  padding: 24,
                }}>
                  <div style={{
                    width: 36, height: 36,
                    border: '2px solid rgba(255,255,255,0.08)',
                    borderTop: '2px solid rgba(196,212,236,0.5)',
                    borderRadius: '50%',
                    animation: 'jarvis-spin 3s linear infinite',
                  }} />
                  <span style={{
                    fontFamily: 'var(--j-font-ui)', fontSize: 12,
                    color: 'rgba(196,212,236,0.38)',
                    textAlign: 'center',
                    lineHeight: 1.5,
                  }}>
                    No activity — query Khameleon to begin
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {agentHistory.slice(0, 15).map((ev, i) => (
                    <div key={ev.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: i % 2 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    }}>
                      <span className="j-mono" style={{ fontSize: 9, color: 'rgba(196,212,236,0.3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {new Date(ev.ts).toLocaleTimeString('en-US', { hour12: false })}
                      </span>
                      <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-teal)', flexShrink: 0 }}>{ev.agent}</span>
                      <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.prompt.slice(0, 60)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </JPanel>
          </div>

          {/* ── CONNECTED SOURCES ── */}
          <div key="sources">
            <JPanel title="Connected sources" icon={<Database size={13} />}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {connectors.slice(0, 12).map(c => (
                  <div key={c.id} className="j-tile" style={{ padding: 8 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.connected ? 'var(--j-green)' : 'rgba(255,255,255,0.15)', marginBottom: 4 }} />
                    <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, fontWeight: 600, color: 'rgba(196,212,236,0.55)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.name}</span>
                    <span className="j-mono" style={{ fontSize: 8, color: c.connected ? 'var(--j-green)' : 'rgba(196,212,236,0.25)' }}>
                      {c.connected ? 'Online' : 'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            </JPanel>
          </div>

          {/* ── QUICK ACTIONS ── */}
          <div key="actions">
            <JPanel title="Quick actions" icon={<Zap size={13} />} badge="">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { icon: <Play size={13} />,      label: 'Morning digest',  action: () => setChatOpen(true) },
                  { icon: <Search size={13} />,    label: 'Deep research',   action: () => setActiveTab('research') },
                  { icon: <Database size={13} />,  label: 'Index memory',    action: () => setActiveTab('memory') },
                  { icon: <Activity size={13} />,  label: 'Run diagnostics', action: () => {} },
                ].map(a => (
                  <button
                    key={a.label}
                    onClick={a.action}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', height: 42, padding: '0 14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderLeft: '2px solid rgba(0,196,184,0.45)',
                      borderRadius: '0 8px 8px 0',
                      color: 'rgba(255,255,255,0.7)',
                      fontFamily: 'var(--j-font-ui)', fontSize: 13, fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background 0.15s, border-left-color 0.15s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(0,196,184,0.06)';
                      (e.currentTarget as HTMLElement).style.borderLeftColor = 'var(--j-teal)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                      (e.currentTarget as HTMLElement).style.borderLeftColor = 'rgba(0,196,184,0.45)';
                    }}
                  >
                    <span style={{ color: 'rgba(0,196,184,0.6)', display: 'flex' }}>{a.icon}</span>
                    {a.label}
                    <ArrowRight size={12} style={{ marginLeft: 'auto', opacity: 0.3 }} />
                  </button>
                ))}

                {!isOnline && (
                  <div style={{ marginTop: 6, padding: '10px 12px', background: 'rgba(226,90,110,0.07)', border: '1px solid rgba(226,90,110,0.18)', borderRadius: 8, fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'rgba(226,90,110,0.75)', lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Radio size={11} />
                    Backend offline — set API keys to connect
                  </div>
                )}
              </div>
            </JPanel>
          </div>
        </GridLayout>
      )}
    </div>
  );
}
