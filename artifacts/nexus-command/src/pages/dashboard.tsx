import { motion } from 'framer-motion';
import { BrainCircuit, Zap, Server, Radio, TrendingUp, Clock, Activity, ArrowRight } from 'lucide-react';
import { useJarvisHealth, useJarvisConnectors } from '@/hooks/useJarvis';
import { useNexusStore } from '@/store/nexusStore';

function HealthCard() {
  const { data: health, isLoading } = useJarvisHealth();
  const status = health?.status ?? 'offline';
  const color = status === 'online' ? '#10b981' : status === 'degraded' ? '#f59e0b' : '#ef4444';
  const glow = status === 'online' ? '16,185,129' : status === 'degraded' ? '245,158,11' : '239,68,68';
  const variant = status === 'online' ? 'green' : status === 'degraded' ? 'gold' : 'red';

  return (
    <div className="nexus-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Server style={{ width: 14, height: 14, color: '#00d4ff' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>System Health</span>
        </div>
        <span className="nexus-badge" data-variant={variant}>{status.toUpperCase()}</span>
      </div>
      {isLoading ? (
        <div className="nexus-shimmer" style={{ height: 60, borderRadius: 8 }} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'ENGINE', value: health?.engine?.toUpperCase() ?? '—', col: color },
            { label: 'MODEL', value: health?.model ?? '—', col: 'rgba(200,230,250,0.9)' },
            { label: 'UPTIME', value: health?.uptime ? `${Math.floor(health.uptime / 60)}m` : '—', col: `rgba(${glow},0.9)` },
            { label: 'STATUS', value: status.toUpperCase(), col: color },
          ].map(({ label, value, col }) => (
            <div key={label}>
              <div style={{ fontSize: 9.5, color: 'rgba(130,170,200,0.45)', letterSpacing: '0.1em', marginBottom: 4, fontFamily: 'var(--font-mono)' }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: 'var(--font-mono)' }}>{value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentActivityFeed() {
  const agentHistory = useNexusStore(s => s.agentHistory);
  return (
    <div className="nexus-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Activity style={{ width: 14, height: 14, color: '#a855f7' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(168,85,247,0.8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Agent Activity</span>
      </div>
      {agentHistory.length === 0 ? (
        <div style={{ padding: '18px 0', textAlign: 'center', color: 'rgba(130,170,200,0.4)', fontSize: 12 }}>
          No recent activity.<br /><span style={{ fontSize: 11, opacity: 0.7 }}>Use the command bar to talk to Nexus.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {agentHistory.slice(0, 5).map(ev => (
            <div key={ev.id} style={{ padding: '10px 12px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.08)', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 9.5, color: '#a855f7', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>{ev.agent.toUpperCase()}</span>
                <span style={{ fontSize: 9.5, color: 'rgba(130,170,200,0.4)', fontFamily: 'var(--font-mono)' }}>{new Date(ev.ts).toLocaleTimeString()}</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(200,225,245,0.8)', lineHeight: 1.4 }}>{ev.prompt.slice(0, 100)}{ev.prompt.length > 100 ? '…' : ''}</div>
              {ev.durationMs && <div style={{ fontSize: 9.5, color: 'rgba(130,170,200,0.35)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>{ev.durationMs}ms · {ev.model}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectorGrid() {
  const { data: connectors, isLoading } = useJarvisConnectors();
  return (
    <div className="nexus-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Radio style={{ width: 14, height: 14, color: '#38bdf8' }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(56,189,248,0.8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Connectors</span>
      </div>
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="nexus-shimmer" style={{ height: 48, borderRadius: 8 }} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          {(connectors ?? []).map(c => (
            <div key={c.id} style={{ padding: '10px 8px', borderRadius: 10, textAlign: 'center', background: c.connected ? 'rgba(16,185,129,0.08)' : 'rgba(0,212,255,0.04)', border: `1px solid ${c.connected ? 'rgba(16,185,129,0.2)' : 'rgba(0,212,255,0.1)'}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.connected ? '#10b981' : 'rgba(130,170,200,0.2)', margin: '0 auto 6px', boxShadow: c.connected ? '0 0 6px #10b981' : 'none' }} />
              <div style={{ fontSize: 9, color: c.connected ? '#10b981' : 'rgba(130,170,200,0.5)', fontWeight: 600, letterSpacing: '0.06em' }}>{c.name.split(' ')[0].toUpperCase().slice(0, 6)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const setActive = useNexusStore(s => s.setActiveModule);
  const setPanelOpen = useNexusStore(s => s.setPanelOpen);

  const quickActions = [
    { label: 'Morning Digest', icon: Clock, color: '#c9a84c', glow: '201,168,76', module: 'agents' },
    { label: 'Ask Orchestrator', icon: BrainCircuit, color: '#a855f7', glow: '168,85,247', module: 'agents' },
    { label: 'Run Research', icon: Zap, color: '#38bdf8', glow: '56,189,248', module: 'research' },
    { label: 'View Analytics', icon: TrendingUp, color: '#10b981', glow: '16,185,129', module: 'analytics' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
        {quickActions.map((qa, i) => {
          const { icon: Icon } = qa;
          return (
            <motion.button key={qa.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              onClick={() => { setActive(qa.module); setPanelOpen(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 12, background: `rgba(${qa.glow},0.07)`, border: `1px solid rgba(${qa.glow},0.2)`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `rgba(${qa.glow},0.12)`, border: `1px solid rgba(${qa.glow},0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon style={{ width: 15, height: 15, color: qa.color }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(220,240,255,0.9)', marginBottom: 2 }}>{qa.label}</div>
                <div style={{ fontSize: 10, color: qa.color, display: 'flex', alignItems: 'center', gap: 3 }}>Open <ArrowRight style={{ width: 10, height: 10 }} /></div>
              </div>
            </motion.button>
          );
        })}
      </div>
      <HealthCard />
      <AgentActivityFeed />
      <ConnectorGrid />
    </div>
  );
}
