import React from 'react';
import {
  Database, Clock, DollarSign, Zap, Activity, Cpu, Settings as SettingsIcon,
} from 'lucide-react';
import { useJarvisHealth, useJarvisTelemetry } from '@/hooks/useJarvis';
import { useJarvisStore } from '@/store/jarvisStore';
import JPanel from '@/components/JPanel';
import HUDRings from '@/components/HUDRings';
import { OFFLINE_HEALTH, MOCK_TELEMETRY } from '@/lib/jarvisApi';

function fmtMs(n?: number)     { return n != null ? `${n.toFixed(0)}ms`  : '0ms'; }
function fmtCost(n?: number)   { return n != null ? `$${n.toFixed(4)}`   : '$0.0000'; }
function fmtEnergy(n?: number) { return n != null ? `${n.toFixed(2)} Wh` : '0.00 Wh'; }
function fmtUptime(s: number)  {
  if (!s) return '0h 0m';
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

// ── Metric box ────────────────────────────────────────────────
function MetricBox({
  icon, label, value, amber,
}: { icon: React.ReactNode; label: string; value: string; amber?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 5,
      background: amber ? 'rgba(226,170,52,0.07)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${amber ? 'rgba(226,170,52,0.20)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 8, padding: '8px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: amber ? 'rgba(226,170,52,0.6)' : 'rgba(196,212,236,0.32)', display: 'flex', flexShrink: 0 }}>
          {icon}
        </span>
        <span style={{
          fontFamily: 'var(--j-font-ui)', fontSize: 10, fontWeight: 500,
          color: amber ? 'rgba(226,170,52,0.55)' : 'rgba(196,212,236,0.42)',
          whiteSpace: 'nowrap', letterSpacing: '0.01em',
        }}>
          {label}
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--j-font-mono)', fontSize: 17, fontWeight: 700,
        color: amber ? '#e2aa34' : '#fff',
        letterSpacing: '-0.01em', lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  );
}

// ── KV row ────────────────────────────────────────────────────
function KVRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <td style={{ padding: '7px 0', width: '36%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'rgba(196,212,236,0.25)', display: 'flex', flexShrink: 0 }}>{icon}</span>
          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: 'rgba(196,212,236,0.42)' }}>{label}</span>
        </div>
      </td>
      <td style={{ padding: '7px 0 7px 6px' }}>
        <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 12, color: 'rgba(196,212,236,0.28)', marginRight: 8 }}>—</span>
        <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{value}</span>
      </td>
    </tr>
  );
}

// ── Overview ─────────────────────────────────────────────────
export default function Overview() {
  const { data: health    = OFFLINE_HEALTH } = useJarvisHealth();
  const { data: telemetry = MOCK_TELEMETRY } = useJarvisTelemetry();
  const agentHistory = useJarvisStore(s => s.agentHistory);
  const isOnline     = health.status !== 'offline';

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      gap: 10,
      padding: 10,
      overflow: 'hidden',
    }}>
      {/* ── Left: System Status ─────────────────────── */}
      <div style={{ flex: '0 0 52%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <JPanel title="System status">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Gauge */}
            <HUDRings health={health} telemetry={telemetry} />

            {/* 4 metric boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              <MetricBox icon={<Database size={9} />} label="Total queries" value={String(health.total_queries ?? 0)} />
              <MetricBox icon={<Clock size={9} />}    label="Avg latency"   value={fmtMs(health.avg_latency_ms)} />
              <MetricBox icon={<DollarSign size={9} />} label="Total cost"  value={fmtCost(health.total_cost_usd)} amber />
              <MetricBox icon={<Zap size={9} />}      label="Energy"        value={fmtEnergy(telemetry.energy_wh)} />
            </div>

            {/* KV table */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <KVRow icon={<SettingsIcon size={10} />} label="Engine" value={health.engine || 'replit-ai'} />
                <KVRow icon={<Cpu size={10} />}          label="Model"  value={health.model  || 'claude-3-5-sonnet / gpt-4o'} />
                <KVRow icon={<Clock size={10} />}        label="Uptime" value={fmtUptime(health.uptime ?? 0)} />
              </tbody>
            </table>

            {/* Listening footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingTop: 2 }}>
              <Activity
                size={11}
                style={{
                  color: isOnline ? 'var(--j-teal)' : 'rgba(196,212,236,0.2)',
                  animation: isOnline ? 'jarvis-pulse 2.5s ease-in-out infinite' : undefined,
                }}
              />
              <span style={{
                fontFamily: 'var(--j-font-ui)', fontSize: 11, fontStyle: 'italic',
                color: 'rgba(196,212,236,0.28)',
              }}>
                Listening for 'Hello Khameleon'
              </span>
            </div>

          </div>
        </JPanel>
      </div>

      {/* ── Right: Agent Activity ────────────────────── */}
      <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <JPanel title="Agent activity" badge="LIVE">
          {agentHistory.length === 0 ? (
            <div style={{
              flex: 1,
              border: '1px dashed rgba(255,255,255,0.12)',
              borderRadius: 10,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 18,
              minHeight: 260,
            }}>
              {/* Spinner */}
              <div style={{
                width: 44, height: 44,
                border: '1.5px solid rgba(255,255,255,0.07)',
                borderTop: '1.5px solid rgba(100,210,220,0.65)',
                borderRadius: '50%',
                animation: 'jarvis-spin 2.2s linear infinite',
              }} />
              <span style={{
                fontFamily: 'var(--j-font-ui)', fontSize: 12,
                color: 'rgba(196,212,236,0.32)',
                textAlign: 'center',
                lineHeight: 1.5,
              }}>
                No activity — query Khameleon to begin
              </span>
            </div>
          ) : (
            <div className="scrollbar-jarvis" style={{ overflowY: 'auto', flex: 1 }}>
              {agentHistory.slice(0, 30).map(ev => (
                <div key={ev.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'rgba(196,212,236,0.28)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {new Date(ev.ts).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                  <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-teal)', flexShrink: 0 }}>
                    {ev.agent}
                  </span>
                  <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ev.prompt.slice(0, 80)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </JPanel>
      </div>
    </div>
  );
}
