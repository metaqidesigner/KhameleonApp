import React, { useState } from 'react';
import GridLayoutRaw from 'react-grid-layout';
import { Play, Search, Database, Activity, Zap } from 'lucide-react';
import { useJarvisHealth, useJarvisTelemetry, useJarvisConnectors } from '@/hooks/useJarvis';
import { useJarvisStore, type PanelLayout } from '@/store/jarvisStore';
import JPanel from '@/components/JPanel';
import HUDRings from '@/components/HUDRings';
import { OFFLINE_HEALTH, MOCK_TELEMETRY } from '@/lib/jarvisApi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GridLayout = GridLayoutRaw as any;

const DEFAULT_LAYOUT: PanelLayout[] = [
  { i:'system',   x:0, y:0,  w:8, h:12 },
  { i:'activity', x:8, y:0,  w:4, h:12 },
  { i:'sources',  x:0, y:12, w:4, h:10 },
  { i:'actions',  x:4, y:12, w:8, h:10 },
];

function fmtMs(n?: number) { return n != null ? `${n.toFixed(0)}ms` : '—'; }
function fmtCost(n?: number) { return n != null ? `$${n.toFixed(4)}` : '—'; }
function fmtEnergy(n?: number) { return n != null ? `${n.toFixed(2)} Wh` : '—'; }

export default function Overview() {
  const { data: health = OFFLINE_HEALTH }    = useJarvisHealth();
  const { data: telemetry = MOCK_TELEMETRY } = useJarvisTelemetry();
  const { data: connectors = [] }            = useJarvisConnectors();
  const { panelLayouts, setPanelLayout, setChatOpen, setActiveTab, agentHistory } = useJarvisStore();
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
    <div ref={containerRef} style={{ height:'100%', overflowY:'auto', padding:8 }} className="scrollbar-jarvis">
      {width > 0 && (
        <GridLayout
          layout={layout}
          cols={12}
          rowHeight={28}
          width={width - 16}
          draggableHandle=".j-panel-header"
          onLayoutChange={(l: PanelLayout[]) => setPanelLayout('overview', l)}
          margin={[6, 6]}
          containerPadding={[0, 0]}
        >
          {/* SYSTEM STATUS */}
          <div key="system">
            <JPanel title="SYSTEM STATUS" icon={<Activity size={13}/>}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
                <HUDRings health={health} telemetry={telemetry} />
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6, width:'100%' }}>
                  {[
                    { label:'TOTAL QUERIES', value: isOnline ? String(health.total_queries ?? 0) : '—' },
                    { label:'AVG LATENCY',   value: fmtMs(health.avg_latency_ms) },
                    { label:'TOTAL COST',    value: fmtCost(health.total_cost_usd) },
                    { label:'ENERGY',        value: fmtEnergy(telemetry.energy_wh) },
                  ].map(m => (
                    <div key={m.label} className="j-metric">
                      <div className="j-metric-header">{m.label}</div>
                      <div className="j-metric-value">{m.value}</div>
                    </div>
                  ))}
                </div>
                <table className="j-table" style={{ width:'100%' }}>
                  <tbody>
                    {[
                      ['Engine',     health.engine || 'none'],
                      ['Model',      health.model  || '—'],
                      ['GPU',        health.gpu    || '—'],
                      ['VRAM',       health.vram_gb != null ? `${health.vram_gb} GB` : '—'],
                      ['Uptime',     health.uptime ? `${Math.floor(health.uptime/3600)}h ${Math.floor((health.uptime%3600)/60)}m` : '—'],
                      ['tok/s',      health.tokens_per_sec?.toFixed(1) ?? '0.0'],
                      ['Watt/query', health.watt_per_query != null ? `${health.watt_per_query.toFixed(2)} W` : '—'],
                    ].map(([k,v]) => (
                      <tr key={k}>
                        <td style={{ color:'var(--j-text-muted)', width:'40%' }}>{k}</td>
                        <td className="j-mono" style={{ color:'#fff' }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </JPanel>
          </div>

          {/* AGENT ACTIVITY */}
          <div key="activity">
            <JPanel title="AGENT ACTIVITY" icon={<Activity size={13}/>} badge="LIVE">
              {agentHistory.length === 0 ? (
                <div className="j-empty">
                  <div style={{ width:40, height:40, border:'2px solid rgba(0,212,255,0.2)', borderRadius:'50%', borderTop:'2px solid var(--j-cyan)', animation:'jarvis-spin 3s linear infinite' }} />
                  NO ACTIVITY — QUERY KHAMELEON TO BEGIN
                </div>
              ) : (
                agentHistory.slice(0, 15).map((ev, i) => (
                  <div key={ev.id} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'6px 0', borderBottom:'1px solid rgba(0,212,255,0.06)', background: i%2 ? 'rgba(0,212,255,0.02)' : 'transparent' }}>
                    <span className="j-mono" style={{ fontSize:9, color:'var(--j-text-muted)', whiteSpace:'nowrap', flexShrink:0 }}>
                      {new Date(ev.ts).toLocaleTimeString('en-US', { hour12:false })}
                    </span>
                    <span className="j-badge j-badge-red" style={{ flexShrink:0 }}>{ev.agent}</span>
                    <span style={{ fontFamily:'var(--j-font-ui)', fontSize:11, color:'var(--j-text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {ev.prompt.slice(0, 50)}
                    </span>
                  </div>
                ))
              )}
            </JPanel>
          </div>

          {/* CONNECTED SOURCES */}
          <div key="sources">
            <JPanel title="CONNECTED SOURCES" icon={<Database size={13}/>}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:5 }}>
                {connectors.slice(0, 12).map(c => (
                  <div key={c.id} className="j-tile" style={{ padding:8 }}>
                    <div style={{ width:6, height:6, borderRadius:'50%', background: c.connected ? 'var(--j-green)' : 'var(--j-text-faint)', marginBottom:4 }} />
                    <span style={{ fontFamily:'var(--j-font-ui)', fontSize:10, fontWeight:600, textTransform:'uppercase', color:'var(--j-text-muted)', textAlign:'center', letterSpacing:'0.04em' }}>{c.name}</span>
                    <span className="j-mono" style={{ fontSize:8, color: c.connected ? 'var(--j-green)' : 'var(--j-text-faint)' }}>
                      {c.connected ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                ))}
              </div>
            </JPanel>
          </div>

          {/* QUICK ACTIONS */}
          <div key="actions">
            <JPanel title="QUICK ACTIONS" icon={<Zap size={13}/>}>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {[
                  { icon:<Play size={14}/>,     label:'MORNING DIGEST',  action: () => setChatOpen(true) },
                  { icon:<Search size={14}/>,   label:'DEEP RESEARCH',   action: () => setActiveTab('research') },
                  { icon:<Database size={14}/>, label:'INDEX MEMORY',    action: () => setActiveTab('memory') },
                  { icon:<Activity size={14}/>, label:'RUN DIAGNOSTICS', action: () => {} },
                ].map(a => (
                  <button key={a.label} className="j-action-btn" onClick={a.action}>
                    {a.icon}▶ {a.label}
                  </button>
                ))}
                {!isOnline && (
                  <div style={{ marginTop:8, padding:'10px 12px', background:'rgba(192,21,42,0.08)', border:'1px solid rgba(192,21,42,0.25)', fontFamily:'var(--j-font-mono)', fontSize:10, color:'var(--j-red)', letterSpacing:'0.06em', lineHeight:1.5 }}>
                    ● BACKEND OFFLINE — SET API KEYS TO CONNECT
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
