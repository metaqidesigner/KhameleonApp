import React, { useState, useEffect } from 'react';
import {
  Database, Clock, DollarSign, Zap, Activity, Cpu, Settings as SettingsIcon,
  Coffee, Sparkles, Users, MessageSquare, FileText, SunMedium,
  CalendarDays, ChevronDown, ChevronRight, Plus, Bot,
} from 'lucide-react';
import { useJarvisHealth, useJarvisTelemetry } from '@/hooks/useJarvis';
import { getDailyTasks, type Task, OFFLINE_HEALTH, MOCK_TELEMETRY } from '@/lib/jarvisApi';
import { useJarvisStore } from '@/store/jarvisStore';
import JPanel from '@/components/JPanel';
import HUDRings from '@/components/HUDRings';

function fmtMs(n?: number)     { return n != null ? `${n.toFixed(0)}ms`  : '0ms'; }
function fmtCost(n?: number)   { return n != null ? `$${n.toFixed(4)}`   : '$0.0000'; }
function fmtEnergy(n?: number) { return n != null ? `${n.toFixed(2)} Wh` : '0.00 Wh'; }
function fmtUptime(s: number)  { if (!s) return '0h 0m'; return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`; }

// ── Metric box ────────────────────────────────────────────────
function MetricBox({ icon, label, value, amber }: { icon: React.ReactNode; label: string; value: string; amber?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 5,
      background: amber ? 'rgba(226,170,52,0.07)' : 'rgba(255,255,255,0.03)',
      border: `1px solid ${amber ? 'rgba(226,170,52,0.20)' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: 8, padding: '8px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: amber ? 'rgba(226,170,52,0.6)' : 'rgba(196,212,236,0.32)', display: 'flex', flexShrink: 0 }}>{icon}</span>
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, fontWeight: 500, color: amber ? 'rgba(226,170,52,0.55)' : 'rgba(196,212,236,0.42)', whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>{label}</span>
      </div>
      <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 17, fontWeight: 700, color: amber ? '#e2aa34' : '#fff', letterSpacing: '-0.01em', lineHeight: 1 }}>{value}</div>
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

// ── Today's Plan section ──────────────────────────────────────

const DAY_SECTIONS = [
  { id: 'start_of_day',   label: 'Start of Day',  time: '7–9 AM',       color: '#7860c2', icon: <Coffee size={11} /> },
  { id: 'core_work',      label: 'Core Work',      time: '9 AM–12 PM',   color: '#c9a84c', icon: <Sparkles size={11} /> },
  { id: 'meetings',       label: 'Meetings',       time: 'As scheduled', color: '#3b82f6', icon: <Users size={11} /> },
  { id: 'communication',  label: 'Communication',  time: 'Batched',      color: '#00c4b8', icon: <MessageSquare size={11} /> },
  { id: 'administrative', label: 'Administrative', time: 'Afternoon',    color: '#e25a6e', icon: <FileText size={11} /> },
  { id: 'end_of_day',     label: 'End of Day',     time: '4–6 PM',       color: '#38cf8a', icon: <SunMedium size={11} /> },
];

function SectionPill({ section, tasks }: { section: typeof DAY_SECTIONS[number]; tasks: Task[] }) {
  const [open, setOpen] = useState(false);
  const active = tasks.filter(t => t.status !== 'done');
  const done   = tasks.filter(t => t.status === 'done');

  return (
    <div style={{
      flex: '1 1 0', minWidth: 120,
      border: `1px solid color-mix(in srgb, ${section.color} 20%, transparent)`,
      borderTop: `2px solid ${section.color}`,
      borderRadius: 8, overflow: 'hidden',
      background: 'rgba(8,14,32,0.55)',
    }}>
      {/* Header */}
      <div
        onClick={() => active.length > 0 && setOpen(o => !o)}
        style={{
          padding: '7px 10px',
          background: `color-mix(in srgb, ${section.color} 7%, transparent)`,
          cursor: active.length > 0 ? 'pointer' : 'default',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
          <span style={{ color: section.color, display: 'flex' }}>{section.icon}</span>
          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, fontWeight: 700, color: '#fff', flex: 1 }}>{section.label}</span>
          {active.length > 0 && (
            open
              ? <ChevronDown size={9} style={{ color: 'var(--j-text-faint)' }} />
              : <ChevronRight size={9} style={{ color: 'var(--j-text-faint)' }} />
          )}
        </div>
        <div style={{ fontFamily: 'var(--j-font-mono)', fontSize: 8, color: 'var(--j-text-faint)' }}>{section.time}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
          {active.length > 0 ? (
            <span style={{
              fontFamily: 'var(--j-font-mono)', fontSize: 11, fontWeight: 700, color: section.color,
            }}>{active.length}</span>
          ) : (
            <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 11, color: 'var(--j-text-faint)' }}>0</span>
          )}
          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 9, color: 'var(--j-text-faint)' }}>
            {active.length === 1 ? 'task' : 'tasks'}
          </span>
          {done.length > 0 && (
            <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 8, color: 'var(--j-green)' }}>✓{done.length}</span>
          )}
        </div>
      </div>

      {/* Task preview (expanded) */}
      {open && active.length > 0 && (
        <div style={{ padding: '4px 0', borderTop: `1px solid color-mix(in srgb, ${section.color} 15%, transparent)` }}>
          {active.slice(0, 4).map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px',
              borderLeft: `2px solid ${section.color}`,
            }}>
              {t.source === 'agent' && <Bot size={8} style={{ color: 'var(--j-violet)', flexShrink: 0 }} />}
              {t.recurrence !== 'one_off' && (
                <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 8, color: 'var(--j-text-faint)', flexShrink: 0 }}>
                  {t.recurrence === 'daily' ? '↺' : '↻'}
                </span>
              )}
              <span style={{
                fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{t.title}</span>
            </div>
          ))}
          {active.length > 4 && (
            <div style={{ padding: '3px 10px', fontFamily: 'var(--j-font-ui)', fontSize: 9, color: 'var(--j-text-faint)' }}>
              +{active.length - 4} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TodaysPlan() {
  const [dailyData, setDailyData]   = useState<Record<string, Task[]>>({});
  const [totalTasks, setTotalTasks] = useState(0);
  const [open, setOpen]             = useState(true);
  const setActiveTab                = useJarvisStore(s => s.setActiveTab);

  useEffect(() => {
    getDailyTasks().then(d => {
      setDailyData(d.sections ?? {});
      setTotalTasks(d.total ?? 0);
    });
  }, []);

  return (
    <div style={{
      flexShrink: 0,
      border: '1px solid rgba(120,168,220,0.10)',
      borderRadius: 12,
      background: 'rgba(8,14,32,0.55)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
          cursor: 'pointer', userSelect: 'none',
          background: 'rgba(255,255,255,0.02)',
          borderBottom: open ? '1px solid rgba(120,168,220,0.08)' : 'none',
        }}
      >
        <CalendarDays size={12} style={{ color: 'var(--j-teal)' }} />
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, fontWeight: 600, color: '#fff', flex: 1 }}>
          Today's Plan
        </span>
        <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)' }}>
          {totalTasks} task{totalTasks !== 1 ? 's' : ''} total
        </span>
        <button
          onClick={e => { e.stopPropagation(); setActiveTab('tasks'); }}
          style={{
            background: 'rgba(0,196,184,0.08)', border: '1px solid rgba(0,196,184,0.2)',
            color: 'var(--j-teal)', fontFamily: 'var(--j-font-ui)', fontSize: 9,
            padding: '2px 8px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
          }}
        >
          <Plus size={8} /> Add Tasks
        </button>
        {open
          ? <ChevronDown size={11} style={{ color: 'var(--j-text-faint)' }} />
          : <ChevronRight size={11} style={{ color: 'var(--j-text-faint)' }} />}
      </div>

      {/* Section pills */}
      {open && (
        <div style={{ display: 'flex', gap: 6, padding: '10px 12px', flexWrap: 'wrap' }}>
          {DAY_SECTIONS.map(s => (
            <SectionPill
              key={s.id}
              section={s}
              tasks={dailyData[s.id] ?? []}
            />
          ))}
        </div>
      )}
    </div>
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
      flexDirection: 'column',
      gap: 10,
      padding: 10,
      overflow: 'hidden',
    }}>
      {/* ── Top row: System Status + Agent Activity ─── */}
      <div style={{ display: 'flex', gap: 10, flex: '1 1 0', minHeight: 0 }}>
        {/* System Status */}
        <div style={{ flex: '0 0 52%', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <JPanel title="System status">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <HUDRings health={health} telemetry={telemetry} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                <MetricBox icon={<Database size={9} />}    label="Total queries" value={String(health.total_queries ?? 0)} />
                <MetricBox icon={<Clock size={9} />}       label="Avg latency"   value={fmtMs(health.avg_latency_ms)} />
                <MetricBox icon={<DollarSign size={9} />}  label="Total cost"    value={fmtCost(health.total_cost_usd)} amber />
                <MetricBox icon={<Zap size={9} />}         label="Energy"        value={fmtEnergy(telemetry.energy_wh)} />
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <KVRow icon={<SettingsIcon size={10} />} label="Engine" value={health.engine || 'replit-ai'} />
                  <KVRow icon={<Cpu size={10} />}          label="Model"  value={health.model  || 'claude-3-5-sonnet / gpt-4o'} />
                  <KVRow icon={<Clock size={10} />}        label="Uptime" value={fmtUptime(health.uptime ?? 0)} />
                </tbody>
              </table>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingTop: 2 }}>
                <Activity size={11} style={{ color: isOnline ? 'var(--j-teal)' : 'rgba(196,212,236,0.2)', animation: isOnline ? 'jarvis-pulse 2.5s ease-in-out infinite' : undefined }} />
                <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, fontStyle: 'italic', color: 'rgba(196,212,236,0.28)' }}>
                  Listening for 'Hello Khameleon'
                </span>
              </div>
            </div>
          </JPanel>
        </div>

        {/* Agent Activity */}
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <JPanel title="Agent activity" badge="LIVE">
            {agentHistory.length === 0 ? (
              <div style={{ flex: 1, border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, minHeight: 200 }}>
                <div style={{ width: 44, height: 44, border: '1.5px solid rgba(255,255,255,0.07)', borderTop: '1.5px solid rgba(100,210,220,0.65)', borderRadius: '50%', animation: 'jarvis-spin 2.2s linear infinite' }} />
                <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: 'rgba(196,212,236,0.32)', textAlign: 'center', lineHeight: 1.5 }}>
                  No activity — query Khameleon to begin
                </span>
              </div>
            ) : (
              <div className="scrollbar-jarvis" style={{ overflowY: 'auto', flex: 1 }}>
                {agentHistory.slice(0, 30).map(ev => (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'rgba(196,212,236,0.28)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {new Date(ev.ts).toLocaleTimeString('en-US', { hour12: false })}
                    </span>
                    <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-teal)', flexShrink: 0 }}>{ev.agent}</span>
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

      {/* ── Today's Plan ───────────────────────────── */}
      <TodaysPlan />
    </div>
  );
}
