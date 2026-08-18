import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Settings, Zap, Sun, Moon } from 'lucide-react';
import { useJarvisStore, type TabId } from '@/store/jarvisStore';
import { useJarvisHealth, useGetCurrentMode } from '@/hooks/useJarvis';

const TABS: { id: TabId; label: string }[] = [
  { id: 'tasks',     label: 'Tasks'     },
  { id: 'overview',  label: 'Overview'  },
  { id: 'agents',    label: 'Agents'    },
  { id: 'research',  label: 'Research'  },
  { id: 'memory',    label: 'Memory'    },
  { id: 'comms',     label: 'Comms'     },
  { id: 'analytics', label: 'Analytics' },
  { id: 'security',  label: 'Security'  },
  { id: 'vault',     label: 'Vault'     },
  { id: 'skills',    label: 'Skills'    },
  { id: 'settings',  label: 'Settings'  },
];

// Teal hexagon brand mark
function HexMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <polygon
        points="9,1.5 16,5.25 16,12.75 9,16.5 2,12.75 2,5.25"
        stroke="#6FE6BD"
        strokeWidth="1.4"
        fill="none"
        opacity="0.9"
      />
      <circle cx="9" cy="9" r="2" fill="#6FE6BD" opacity="0.5" />
    </svg>
  );
}

// Live clock
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const d = days[now.getDay()];
  const t = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 12, color: 'rgba(196,212,236,0.7)', letterSpacing: '0.06em' }}>
      {d} {t}
    </span>
  );
}

// Theme toggle — persists to localStorage, applies .light class to <html>
function ThemeToggle() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('khameleon-theme');
    if (stored === 'light') {
      setIsDark(false);
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggle = useCallback(() => {
    setIsDark(prev => {
      const next = !prev;
      document.documentElement.classList.toggle('light', !next);
      localStorage.setItem('khameleon-theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="j-icon-btn"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center', color: 'rgba(196,212,236,0.5)' }}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}

export default function TopBar() {
  const activeTab             = useJarvisStore(s => s.activeTab);
  const setActiveTab          = useJarvisStore(s => s.setActiveTab);
  const setCommandPaletteOpen = useJarvisStore(s => s.setCommandPaletteOpen);
  const activeTaskIds         = useJarvisStore(s => s.activeTaskIds);
  const { data: health }      = useJarvisHealth();
  const { data: mode }        = useGetCurrentMode();

  const isOnline     = health?.status !== 'offline' && health != null;
  const engine       = health?.engine ?? 'Offline';
  const model        = health?.model  ?? '—';
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
      background: 'rgba(6,9,20,0.97)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      display: 'flex', alignItems: 'stretch',
      position: 'relative', zIndex: 20,
    }}>

      {/* ── Brand ─────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 20px 0 14px', flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
        <HexMark />
        <span style={{
          fontFamily: 'var(--j-font-head)',
          fontSize: 14, fontWeight: 700,
          color: 'var(--j-teal)',
          letterSpacing: '0.28em',
          animation: 'jarvis-flicker 14s linear infinite',
        }}>
          KHAMELEON
        </span>
      </div>

      {/* ── Mode label ────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 14px', flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
        <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, color: 'rgba(196,212,236,0.45)', whiteSpace: 'nowrap' }}>
          {mode?.name
            ? (mode.name.charAt(0).toUpperCase() + mode.name.slice(1).toLowerCase()).replace(/\bmode\b/i, 'mode')
            : 'Work mode'}
        </span>
      </div>

      {/* ── Tabs ──────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', overflowX: 'auto' }}>
        {TABS.map(tab => {
          const active    = activeTab === tab.id;
          const isTasksTab = tab.id === 'tasks';
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                position: 'relative', height: '100%', padding: '0 14px',
                background: 'transparent', border: 'none',
                borderBottom: active ? '2px solid var(--j-teal)' : '2px solid transparent',
                color: active ? 'var(--j-teal)' : 'rgba(196,212,236,0.42)',
                fontFamily: 'var(--j-font-ui)', fontSize: 13,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
                flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: 5,
                letterSpacing: '0.01em',
              }}
            >
              {isTasksTab && <Zap size={11} style={{ opacity: active ? 0.9 : 0.5 }} />}
              {tab.label}
              {isTasksTab && runningCount > 0 && (
                <span style={{
                  minWidth: 15, height: 15, padding: '0 4px',
                  background: 'var(--j-teal)', borderRadius: 8,
                  fontFamily: 'var(--j-font-mono)', fontSize: 8,
                  color: '#000', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'jarvis-pulse 1.8s ease-in-out infinite',
                }}>
                  {runningCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Right status ──────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 14px', flexShrink: 0,
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}>
        <LiveClock />

        <span style={{ color: 'rgba(255,255,255,0.08)', fontSize: 16 }}>|</span>

        {/* Online status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: isOnline ? 'var(--j-green)' : 'var(--j-coral)',
            boxShadow: isOnline ? '0 0 5px var(--j-green)' : 'none',
          }} />
          <span style={{ fontFamily: 'var(--j-font-ui)', fontSize: 11, color: 'rgba(196,212,236,0.55)', whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>
            {engine} · {model}
          </span>
        </div>

        {/* ⌘K */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="j-icon-btn"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(196,212,236,0.5)', fontFamily: 'var(--j-font-mono)', fontSize: 9, padding: '3px 8px', cursor: 'pointer', letterSpacing: '0.06em', borderRadius: 5 }}>
          ⌘K
        </button>

        {/* Bell */}
        <button className="j-icon-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(196,212,236,0.5)', padding: 0, position: 'relative', display: 'flex' }}>
          <Bell size={15} />
          <span style={{ position: 'absolute', top: -5, right: -5, width: 14, height: 14, background: 'var(--j-coral)', borderRadius: '50%', fontFamily: 'var(--j-font-mono)', fontSize: 7, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>3</span>
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Settings */}
        <button onClick={() => setActiveTab('settings')} className="j-icon-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(196,212,236,0.5)', padding: 0, display: 'flex' }}>
          <Settings size={14} />
        </button>
      </div>
    </div>
  );
}
