import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Database, Clock, DollarSign, Zap, Activity, Cpu, Settings as SettingsIcon,
  Coffee, Sparkles, Users, MessageSquare, FileText, SunMedium,
  CalendarDays, ChevronDown, ChevronRight, Plus, Bot, AlarmClock,
  Compass, ListTodo, Radio, Gauge,
} from 'lucide-react';
import { useJarvisHealth, useJarvisTelemetry } from '@/hooks/useJarvis';
import { getDailyTasks, getSchedulerStatus, type Task, type SchedulerStatus, OFFLINE_HEALTH, MOCK_TELEMETRY } from '@/lib/jarvisApi';
import { useJarvisStore } from '@/store/jarvisStore';
import HUDRings from '@/components/HUDRings';
import { FloatingWindow } from '@/components/FloatingWindow';
import { AssistantCard } from '@/components/AssistantCard';

function fmtMs(n?: number)     { return n != null ? `${n.toFixed(0)}ms`  : '0ms'; }
function fmtCost(n?: number)   { return n != null ? `$${n.toFixed(4)}`   : '$0.0000'; }
function fmtEnergy(n?: number) { return n != null ? `${n.toFixed(2)} Wh` : '0.00 Wh'; }
function fmtUptime(s: number)  { if (!s) return '0h 0m'; return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`; }

// ── Concept pills ─────────────────────────────────────────────
const PILLS = [
  { id: 'command', label: 'COMMAND', sub: 'You ask. I execute.',        dot: '#38cf8a' },
  { id: 'context', label: 'CONTEXT', sub: 'I understand what matters.', dot: '#F0A34C' },
  { id: 'status',  label: 'STATUS',  sub: 'I keep you in the loop.',    dot: '#8C7CF0' },
];

// ── Small wavy sparkline ──────────────────────────────────────
function Sparkline({ color }: { color: string }) {
  return (
    <svg width="100%" height="16" viewBox="0 0 80 16" preserveAspectRatio="none" fill="none" aria-hidden>
      <polyline
        points="0,13 10,7 20,10 30,4 40,8 50,5 60,9 70,3 80,7"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.55"
      />
    </svg>
  );
}

// ── Section status indicator ──────────────────────────────────
function StatusIcon({ active, done, color }: { active: number; done: number; color: string }) {
  if (done > 0 && active === 0) {
    return (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
        <circle cx="6.5" cy="6.5" r="5.5" stroke="#6FE6BD" strokeWidth="1.2" />
        <path d="M3.5 6.5l2 2 4-4" stroke="#6FE6BD" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (active > 0) {
    return (
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ animation: 'jarvis-spin 2s linear infinite' }}>
        <circle cx="6.5" cy="6.5" r="5.5" stroke={color} strokeWidth="1.3" strokeDasharray="5 3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="5.5" stroke="rgba(196,212,236,0.18)" strokeWidth="1.1" strokeDasharray="2 2" />
    </svg>
  );
}

// ── Metric box — glass card ───────────────────────────────────
function MetricBox({
  icon, label, value, amber,
}: {
  icon: React.ReactNode; label: string; value: string; dotColor?: string; amber?: boolean;
}) {
  const accentRgb = amber ? '240,163,76' : '111,230,189';
  return (
    <div className="j-metric-box" style={{
      display: 'flex', flexDirection: 'column', gap: 6,
      background: `rgba(${accentRgb},0.05)`,
      border: `1px solid rgba(${accentRgb},0.16)`,
      borderRadius: 14,
      padding: '9px 11px',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.10), 0 0 16px rgba(${accentRgb},0.05)`,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14,
        background: 'linear-gradient(140deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 50%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
          background: amber ? 'var(--j-amber)' : 'var(--j-teal)',
          boxShadow: `0 0 4px ${amber ? 'var(--j-amber)' : 'var(--j-teal)'}`,
        }} />
        <span style={{ color: 'var(--j-text-faint)', display: 'flex', flexShrink: 0 }}>{icon}</span>
        <span style={{
          fontFamily: 'var(--j-font-ui)', fontSize: 10, fontWeight: 500,
          color: amber ? 'var(--j-amber)' : 'var(--j-text-muted)',
          whiteSpace: 'nowrap', letterSpacing: '0.01em',
        }}>{label}</span>
      </div>
      <div style={{
        fontFamily: 'var(--j-font-mono)', fontSize: 17, fontWeight: 700,
        color: amber ? 'var(--j-amber)' : 'var(--j-text)',
        letterSpacing: '-0.01em', lineHeight: 1, position: 'relative',
      }}>{value}</div>
    </div>
  );
}

// ── KV row ────────────────────────────────────────────────────
function KVRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <td style={{ padding: '7px 0', width: '36%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--j-text-faint)', display: 'flex', flexShrink: 0 }}>{icon}</span>
          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: 'var(--j-text-muted)' }}>{label}</span>
        </div>
      </td>
      <td style={{ padding: '7px 0 7px 6px' }}>
        <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 12, color: 'var(--j-text-faint)', marginRight: 8 }}>—</span>
        <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 12, color: 'var(--j-text)' }}>{value}</span>
      </td>
    </tr>
  );
}

// ── Today's Plan sections ─────────────────────────────────────
const DAY_SECTIONS = [
  { id: 'start_of_day',   label: 'Start of Day',  time: '7–9 AM',       color: '#8C7CF0', icon: <Coffee size={11} /> },
  { id: 'core_work',      label: 'Core Work',      time: '9 AM–12 PM',   color: '#F0A34C', icon: <Sparkles size={11} /> },
  { id: 'meetings',       label: 'Meetings',       time: 'As scheduled', color: '#6FE6BD', icon: <Users size={11} /> },
  { id: 'communication',  label: 'Communication',  time: 'Batched',      color: '#6FE6BD', icon: <MessageSquare size={11} /> },
  { id: 'administrative', label: 'Administrative', time: 'Afternoon',    color: '#E77A7A', icon: <FileText size={11} /> },
  { id: 'end_of_day',     label: 'End of Day',     time: '4–6 PM',       color: '#6FE6BD', icon: <SunMedium size={11} /> },
];

function SectionPill({ section, tasks }: { section: typeof DAY_SECTIONS[number]; tasks: Task[] }) {
  const [open, setOpen] = useState(false);
  const active = tasks.filter(t => t.status !== 'done');
  const done   = tasks.filter(t => t.status === 'done');
  const col    = section.color;

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  };
  const rgb = hexToRgb(col);

  return (
    <div className="j-section-pill" style={{
      flex: '1 1 0', minWidth: 120,
      background: `rgba(${rgb},0.05)`,
      border: `1px solid rgba(${rgb},0.20)`,
      borderRadius: 14,
      overflow: 'hidden',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.10), 0 0 20px rgba(${rgb},0.06)`,
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 14,
        background: 'linear-gradient(140deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 45%, transparent 65%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '6px 10px 0', opacity: active.length > 0 ? 1 : 0.4 }}>
        <Sparkline color={col} />
      </div>

      <div
        onClick={() => active.length > 0 && setOpen(o => !o)}
        style={{ padding: '6px 10px 8px', cursor: active.length > 0 ? 'pointer' : 'default', position: 'relative', zIndex: 1 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <span style={{ color: col, display: 'flex', flexShrink: 0 }}>{section.icon}</span>
          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, fontWeight: 700, color: 'var(--j-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {section.label}
          </span>
          <StatusIcon active={active.length} done={done.length} color={col} />
          {active.length > 0 && (
            open
              ? <ChevronDown size={9} style={{ color: 'var(--j-text-faint)' }} />
              : <ChevronRight size={9} style={{ color: 'var(--j-text-faint)' }} />
          )}
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center',
          fontFamily: 'var(--j-font-mono)', fontSize: 8,
          color: col, opacity: 0.65,
          background: `rgba(${rgb},0.10)`,
          border: `1px solid rgba(${rgb},0.20)`,
          borderRadius: 4, padding: '1px 5px', marginBottom: 4,
        }}>
          {section.time}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            fontFamily: 'var(--j-font-mono)', fontSize: 13, fontWeight: 700,
            color: active.length > 0 ? col : 'var(--j-text-faint)',
          }}>
            {active.length}
          </span>
          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 9, color: 'var(--j-text-faint)' }}>
            {active.length === 1 ? 'task' : 'tasks'}
          </span>
          {done.length > 0 && (
            <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 8, color: '#6FE6BD', marginLeft: 2 }}>✓{done.length}</span>
          )}
        </div>
      </div>

      {open && active.length > 0 && (
        <div style={{ borderTop: `1px solid rgba(${rgb},0.14)`, padding: '4px 0', position: 'relative', zIndex: 1 }}>
          {active.slice(0, 4).map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px',
              borderLeft: `2px solid ${col}`,
            }}>
              {t.source === 'agent' && <Bot size={8} style={{ color: 'var(--j-violet)', flexShrink: 0 }} />}
              {t.recurrence !== 'one_off' && (
                <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 8, color: 'var(--j-text-faint)', flexShrink: 0 }}>
                  {t.recurrence === 'daily' ? '↺' : '↻'}
                </span>
              )}
              <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 10, color: 'var(--j-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.title}
              </span>
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

// ── Digest countdown badge ────────────────────────────────────
function formatCountdown(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function DigestCountdownBadge({ onClick }: { onClick: () => void }) {
  const [status, setStatus]       = useState<SchedulerStatus | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const refetchRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(() => {
    getSchedulerStatus().then(setStatus);
  }, []);

  // Initial fetch + 5-minute periodic refresh + re-fetch on window focus
  useEffect(() => {
    fetchStatus();
    refetchRef.current = setInterval(fetchStatus, 5 * 60 * 1000);
    window.addEventListener('focus', fetchStatus);
    return () => {
      if (refetchRef.current) clearInterval(refetchRef.current);
      window.removeEventListener('focus', fetchStatus);
    };
  }, [fetchStatus]);

  // 30-second tick to update the local countdown display
  useEffect(() => {
    if (!status) return;

    const tick = () => {
      if (!status.nextRunAt) { setCountdown(''); return; }
      const diff = new Date(status.nextRunAt).getTime() - Date.now();
      if (diff > 0) {
        setCountdown(formatCountdown(diff));
      } else {
        // Countdown expired — re-fetch so we pick up the fresh nextRunAt/lastRunAt
        setCountdown('now');
        fetchStatus();
      }
    };

    tick();
    timerRef.current = setInterval(tick, 30000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, fetchStatus]);

  if (!status) return null;

  const ranTodayStr = status.lastRunAt && isSameDay(new Date(status.lastRunAt), new Date())
    ? new Date(status.lastRunAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;

  let label: string;
  let accentR: string;
  let accentC: string;

  if (!status.enabled) {
    label   = 'Digest disabled';
    accentR = '196,212,236';
    accentC = 'var(--j-text-faint)';
  } else if (ranTodayStr) {
    // Digest already fired today — show confirmation instead of next-run countdown
    label   = `Ran today at ${ranTodayStr}`;
    accentR = '111,230,189';
    accentC = '#6FE6BD';
  } else if (!status.nextRunAt) {
    label   = 'Digest not scheduled';
    accentR = '196,212,236';
    accentC = 'var(--j-text-faint)';
  } else {
    label   = `Next digest in ${countdown}`;
    accentR = '240,163,76';
    accentC = '#F0A34C';
  }

  return (
    <button
      onClick={onClick}
      title="Click to open Auto Triggers"
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        background: `rgba(${accentR},0.08)`,
        border: `1px solid rgba(${accentR},0.25)`,
        borderRadius: 8, padding: '3px 8px',
        cursor: 'pointer', flexShrink: 0,
        boxShadow: `0 0 8px rgba(${accentR},0.10)`,
      }}
    >
      <AlarmClock size={9} style={{ color: accentC, flexShrink: 0 }} />
      <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: accentC, whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
}

// ── Today's Plan window body ──────────────────────────────────
function TodaysPlanBody() {
  const [dailyData, setDailyData]   = useState<Record<string, Task[]>>({});
  const [totalTasks, setTotalTasks] = useState(0);
  const setActiveTab                = useJarvisStore(s => s.setActiveTab);

  useEffect(() => {
    getDailyTasks().then(d => {
      setDailyData(d.sections ?? {});
      setTotalTasks(d.total ?? 0);
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CalendarDays size={13} style={{ color: 'var(--j-amber)', flexShrink: 0 }} />
        <span className="j-mono" style={{ fontSize: 9, color: 'var(--j-text-faint)', flex: 1 }}>
          {totalTasks} task{totalTasks !== 1 ? 's' : ''} total
        </span>
        <DigestCountdownBadge onClick={() => setActiveTab('tasks')} />
        <button
          onClick={() => setActiveTab('tasks')}
          style={{
            background: 'rgba(240,163,76,0.08)', border: '1px solid rgba(240,163,76,0.22)',
            color: 'var(--j-amber)', fontFamily: 'var(--j-font-ui)', fontSize: 9,
            padding: '2px 9px', borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 3,
            boxShadow: '0 0 8px rgba(240,163,76,0.10)',
          }}
        >
          <Plus size={8} /> Add Tasks
        </button>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {DAY_SECTIONS.map(s => (
          <SectionPill key={s.id} section={s} tasks={dailyData[s.id] ?? []} />
        ))}
      </div>
    </div>
  );
}

// ── Today's Focus ring (fixed bottom-left) ────────────────────
function FocusRing({ pct }: { pct: number }) {
  const r = 22, cx = 28, cy = 28;
  const circ = 2 * Math.PI * r;
  const dash  = circ * pct;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="#6FE6BD" strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy + 1}
        textAnchor="middle" dominantBaseline="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif"
        fontSize="9" fontWeight="600" fill="rgba(196,212,236,0.80)">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

// ── System Status window body ─────────────────────────────────
function SystemStatusBody() {
  const { data: health    = OFFLINE_HEALTH } = useJarvisHealth();
  const { data: telemetry = MOCK_TELEMETRY } = useJarvisTelemetry();
  const isOnline = health.status !== 'offline';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <HUDRings health={health} telemetry={telemetry} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7 }}>
        <MetricBox icon={<Database size={9} />}   label="Total queries" value={String(health.total_queries ?? 0)} />
        <MetricBox icon={<Clock size={9} />}      label="Avg latency"   value={fmtMs(health.avg_latency_ms)} />
        <MetricBox icon={<DollarSign size={9} />} label="Total cost"    value={fmtCost(health.total_cost_usd)} amber />
        <MetricBox icon={<Zap size={9} />}        label="Energy"        value={fmtEnergy(telemetry.energy_wh)} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <KVRow icon={<SettingsIcon size={10} />} label="Engine" value={health.engine || 'replit-ai'} />
          <KVRow icon={<Cpu size={10} />}          label="Model"  value={health.model  || 'claude-3-5-sonnet / gpt-4o'} />
          <KVRow icon={<Clock size={10} />}        label="Uptime" value={fmtUptime(health.uptime ?? 0)} />
        </tbody>
      </table>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingTop: 2 }}>
        <Activity size={11} style={{
          color: isOnline ? 'var(--j-teal)' : 'var(--j-text-faint)',
          animation: isOnline ? 'jarvis-pulse 2.5s ease-in-out infinite' : undefined,
        }} />
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, fontStyle: 'italic', color: 'var(--j-text-faint)' }}>
          Listening for 'Hello Khameleon'
        </span>
      </div>
    </div>
  );
}

// ── Agent Activity window body ────────────────────────────────
function AgentActivityBody() {
  const agentHistory = useJarvisStore(s => s.agentHistory);

  if (agentHistory.length === 0) {
    return (
      <div style={{
        border: '1px dashed rgba(140,124,240,0.18)',
        borderRadius: 12, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 18, minHeight: 200, height: '100%',
      }}>
        <div style={{
          width: 44, height: 44,
          border: '1.5px solid rgba(140,124,240,0.15)',
          borderTop: '1.5px solid rgba(140,124,240,0.65)',
          borderRadius: '50%',
          animation: 'jarvis-spin 2.2s linear infinite',
        }} />
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: 'var(--j-text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
          No activity — query Khameleon to begin
        </span>
      </div>
    );
  }

  return (
    <div className="scrollbar-jarvis" style={{ overflowY: 'auto', height: '100%' }}>
      {agentHistory.slice(0, 30).map(ev => (
        <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-text-faint)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {new Date(ev.ts).toLocaleTimeString('en-US', { hour12: false })}
          </span>
          <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, color: 'var(--j-teal)', flexShrink: 0 }}>{ev.agent}</span>
          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'var(--j-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ev.prompt.slice(0, 80)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Unified Canvas page ───────────────────────────────────────
export default function UnifiedCanvas() {
  // Newest event is always prepended, so its id changes on every push —
  // this keeps working even after the history hits its 50-item cap.
  const latestEventId = useJarvisStore(s => s.agentHistory[0]?.id);

  // ── Today's Focus ring — real progress from daily tasks ───
  const [focusPct, setFocusPct] = useState(0);
  useEffect(() => {
    getDailyTasks().then(d => {
      const done  = d.doneCount ?? 0;
      const grand = (d.total ?? 0) + done;  // active + done = all tasks ever
      setFocusPct(grand > 0 ? done / grand : 0);
    });
  }, []);

  // When a new agent event lands, pull the Agent Activity window into focus
  // (animated lift toward canvas centre) for 4 s, then settle back.
  const [activityFocused, setActivityFocused] = useState(false);
  const prevIdRef = useRef(latestEventId);
  useEffect(() => {
    if (latestEventId !== undefined && latestEventId !== prevIdRef.current) {
      prevIdRef.current = latestEventId;
      setActivityFocused(true);
      const t = setTimeout(() => setActivityFocused(false), 4000);
      return () => clearTimeout(t);
    }
    prevIdRef.current = latestEventId;
    return undefined;
  }, [latestEventId]);

  return (
    <div className="kc-canvas">
      {/* ── Left zone: in-progress work ─────────────────── */}
      <div className="kc-col kc-col-left">
        <FloatingWindow icon={<Compass size={11} />} label="Khameleon" windowId="khameleon">
          <div className="ac-concept-pills" style={{ maxWidth: 'none' }}>
            {PILLS.map(pill => (
              <div key={pill.id} className="ac-pill">
                <div className="ac-pill-label">
                  <span className="ac-pill-dot" style={{ background: pill.dot }} />
                  <span style={{ color: pill.dot }}>{pill.label}</span>
                </div>
                <div className="ac-pill-sub">{pill.sub}</div>
              </div>
            ))}
          </div>
        </FloatingWindow>

        <FloatingWindow icon={<ListTodo size={11} />} label="Today's Plan" windowId="todays-plan" grow>
          <TodaysPlanBody />
        </FloatingWindow>
      </div>

      {/* ── Centre zone: finished / result-ready ─────────── */}
      <div className="kc-col kc-col-centre">
        <FloatingWindow icon={<Radio size={11} />} label="Agent Activity" windowId="agent-activity" badge="LIVE" focused={activityFocused} grow>
          <AgentActivityBody />
        </FloatingWindow>
      </div>

      {/* ── Right zone: supporting info + chat ───────────── */}
      <div className="kc-col kc-col-right">
        <FloatingWindow icon={<Gauge size={11} />} label="System Status" windowId="system-status">
          <SystemStatusBody />
        </FloatingWindow>

        <div className="kc-assistant-slot">
          <AssistantCard />
        </div>
      </div>

      {/* ── Today's Focus — fixed bottom-left ────────────── */}
      <div className="ac-focus-card">
        <div className="ac-focus-label">TODAY'S{'\n'}FOCUS</div>
        <div className="ac-focus-ring">
          <FocusRing pct={focusPct} />
        </div>
      </div>
    </div>
  );
}
