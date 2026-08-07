import React, { useState, useEffect } from 'react';
import { Bell, Settings, Zap } from 'lucide-react';
import { useJarvisStore, type TabId } from '@/store/jarvisStore';
import { useJarvisHealth, useGetCurrentMode } from '@/hooks/useJarvis';

const TABS: { id: TabId; label: string; pinned?: boolean }[] = [
  { id: 'tasks',     label: 'TASKS',     pinned: true },
  { id: 'overview',  label: 'OVERVIEW' },
  { id: 'agents',    label: 'AGENTS' },
  { id: 'research',  label: 'RESEARCH' },
  { id: 'memory',    label: 'MEMORY' },
  { id: 'comms',     label: 'COMMS' },
  { id: 'analytics', label: 'ANALYTICS' },
  { id: 'security',  label: 'SECURITY' },
  { id: 'vault',     label: 'VAULT' },
  { id: 'skills',    label: 'SKILLS' },
  { id: 'settings',  label: 'SETTINGS' },
];

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const d = days[now.getDay()];
  const t = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 12, color: 'var(--j-teal)', letterSpacing: '0.08em' }}>
      {d} {t}
    </span>
  );
}

export default function TopBar() {
  const activeTab            = useJarvisStore(s => s.activeTab);
  const setActiveTab         = useJarvisStore(s => s.setActiveTab);
  const setCommandPaletteOpen = useJarvisStore(s => s.setCommandPaletteOpen);
  const activeTaskIds        = useJarvisStore(s => s.activeTaskIds);
  const { data: health } = useJarvisHealth();
  const { data: mode }   = useGetCurrentMode();

  const isOnline = health?.status !== 'offline' && health != null;
  const engine   = health?.engine ?? 'OFFLINE';
  const model    = health?.model  ?? '—';
  const runningCount = activeTaskIds.length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandPaletteOpen]);

  return (
    <div style={{
      height: 44, flexShrink: 0,
      background: 'rgba(8, 14, 32, 0.92)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid rgba(0, 196, 184, 0.14)',
      boxShadow: '0 2px 24px rgba(0,0,0,0.5), 0 0 40px rgba(0,196,184,0.05)',
      display: 'flex', alignItems: 'stretch',
      position: 'relative', zIndex: 20,
    }}>
      {/* ── Brand ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', borderRight: '1px solid rgba(0,196,184,0.10)', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 3 }}>
          {[0, 80, 160].map(delay => (
            <div key={delay} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--j-teal)', animation: `jarvis-pulse 1.8s ease-in-out ${delay}ms infinite`, opacity: 0.8 }} />
          ))}
        </div>
        <span style={{ fontFamily: 'var(--j-font-head)', fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.30em', animation: 'jarvis-flicker 12s linear infinite' }}>
          KHAMELEON
        </span>
        <span style={{ color: 'rgba(0,196,184,0.20)', fontSize: 18 }}>|</span>
        <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 9, letterSpacing: '0.08em', padding: '2px 7px', background: 'rgba(0,196,184,0.10)', border: '1px solid rgba(0,196,184,0.22)', borderRadius: 10, color: 'var(--j-teal)' }}>
          {(mode?.name ?? 'WORK').toUpperCase()}
        </span>
      </div>

      {/* ── Tabs ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', overflowX: 'auto' }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          const isTasksTab = tab.id === 'tasks';
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                position: 'relative',
                height: '100%', padding: '0 12px',
                background: active ? 'rgba(0,196,184,0.07)' : 'transparent',
                border: 'none',
                borderBottom: active ? '2px solid var(--j-teal)' : '2px solid transparent',
                color: active ? '#fff' : 'var(--j-text-muted)',
                fontFamily: 'var(--j-font-ui)', fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.14em',
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'color 0.15s, background 0.15s',
                flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {/* TASKS icon */}
              {isTasksTab && <Zap size={11} style={{ color: active ? 'var(--j-teal)' : 'inherit' }} />}
              {tab.label}
              {/* Active task count badge */}
              {isTasksTab && runningCount > 0 && (
                <span style={{
                  minWidth: 16, height: 16, padding: '0 4px',
                  background: 'rgba(0,196,184,0.85)', borderRadius: 8,
                  fontFamily: 'var(--j-font-mono)', fontSize: 8,
                  color: '#000', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'jarvis-pulse 1.5s ease-in-out infinite',
                }}>
                  {runningCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Right status ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderLeft: '1px solid rgba(0,196,184,0.10)', flexShrink: 0 }}>
        <LiveClock />
        <span style={{ color: 'rgba(0,196,184,0.15)', fontSize: 16 }}>|</span>
        <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 10, color: 'var(--j-text-muted)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
          <span style={{ color: isOnline ? 'var(--j-green)' : 'var(--j-coral)' }}>●</span>{' '}
          {engine.toUpperCase()} · {model.toUpperCase()}
        </span>
        <span style={{ color: 'rgba(0,196,184,0.15)', fontSize: 16 }}>|</span>
        <button
          onClick={() => setCommandPaletteOpen(true)}
          style={{ background: 'rgba(0,196,184,0.07)', border: '1px solid rgba(0,196,184,0.18)', color: 'var(--j-text-muted)', fontFamily: 'var(--j-font-mono)', fontSize: 9, padding: '3px 7px', cursor: 'pointer', letterSpacing: '0.06em', borderRadius: 6 }}>
          ⌘K
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-text-muted)', padding: 0, position: 'relative' }}>
          <Bell size={15} />
          <span style={{ position: 'absolute', top: -4, right: -4, width: 13, height: 13, background: 'var(--j-coral)', borderRadius: '50%', fontFamily: 'var(--j-font-mono)', fontSize: 7, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
        </button>
        <button onClick={() => setActiveTab('settings')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--j-text-muted)', padding: 0 }}>
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}
