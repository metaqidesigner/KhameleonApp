import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Key, RefreshCw, Activity } from 'lucide-react';
import { useJarvisHealth } from '@/hooks/useJarvis';
import { useNexusStore } from '@/store/nexusStore';

const API_KEYS = [
  { id: 'OPENAI_API_KEY', label: 'OpenAI', color: '#10b981' },
  { id: 'ANTHROPIC_API_KEY', label: 'Anthropic', color: '#a855f7' },
  { id: 'JARVIS_ENGINE', label: 'Jarvis Engine', color: '#00d4ff' },
  { id: 'SESSION_SECRET', label: 'Session Secret', color: '#c9a84c' },
];

export default function Security() {
  const { data: health, refetch, isFetching } = useJarvisHealth();
  const agentHistory = useNexusStore(s => s.agentHistory);

  const status = health?.status ?? 'offline';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Security</h2>
        <p style={{ fontSize: 12, color: 'rgba(130,170,200,0.55)', lineHeight: 1.5 }}>Monitor API key status, run diagnostics, and review the audit log.</p>
      </div>

      {/* API key status */}
      <div className="nexus-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Key style={{ width: 14, height: 14, color: '#ef4444' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(239,68,68,0.8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>API Key Status</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {API_KEYS.map(key => (
            <div key={key.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.08)', borderRadius: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(130,170,200,0.3)' }} />
                <span style={{ fontSize: 12, color: 'rgba(200,225,245,0.8)', fontFamily: 'var(--font-mono)' }}>{key.id}</span>
              </div>
              <span className="nexus-badge" data-variant="red">UNSET</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'rgba(130,170,200,0.4)', marginTop: 12, lineHeight: 1.5 }}>Key values are never displayed. Use environment variables to configure credentials.</p>
      </div>

      {/* Diagnostics */}
      <div className="nexus-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {status === 'online' ? <ShieldCheck style={{ width: 14, height: 14, color: '#10b981' }} /> : <ShieldAlert style={{ width: 14, height: 14, color: '#ef4444' }} />}
            <span style={{ fontSize: 11, fontWeight: 600, color: status === 'online' ? 'rgba(16,185,129,0.8)' : 'rgba(239,68,68,0.8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              System Diagnostics
            </span>
          </div>
          <button className="nexus-btn" onClick={() => refetch()} disabled={isFetching}
            style={{ padding: '6px 14px', fontSize: 11, borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}>
            <RefreshCw style={{ width: 12, height: 12 }} className={isFetching ? 'animate-spin' : ''} />
            {isFetching ? 'Running…' : 'Run Diagnostics'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Backend', value: status.toUpperCase(), ok: status === 'online' },
            { label: 'Engine', value: health?.engine ?? '—', ok: !!health?.engine && health.engine !== 'none' },
            { label: 'Model', value: health?.model ?? '—', ok: !!health?.model && health.model !== '—' },
            { label: 'Uptime', value: health?.uptime ? `${Math.floor(health.uptime / 60)}m` : '—', ok: !!health?.uptime },
          ].map(({ label, value, ok }) => (
            <div key={label} style={{ padding: '10px 14px', background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.06)', borderRadius: 10 }}>
              <div style={{ fontSize: 9.5, color: 'rgba(130,170,200,0.45)', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: ok ? '#10b981' : '#ef4444', fontFamily: 'var(--font-mono)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Audit log */}
      <div className="nexus-card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Activity style={{ width: 14, height: 14, color: '#c9a84c' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(201,168,76,0.8)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Audit Log</span>
        </div>
        {agentHistory.length === 0 ? (
          <div style={{ color: 'rgba(130,170,200,0.4)', fontSize: 12, padding: '12px 0' }}>No events recorded this session.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {agentHistory.slice(0, 10).map((ev, i) => (
              <motion.div key={ev.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.08)', borderRadius: 8 }}>
                <span style={{ fontSize: 9.5, color: '#c9a84c', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{new Date(ev.ts).toLocaleTimeString()}</span>
                <span style={{ fontSize: 10, color: 'rgba(168,85,247,0.8)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{ev.agent.toUpperCase()}</span>
                <span style={{ fontSize: 11, color: 'rgba(190,220,240,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.prompt}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
