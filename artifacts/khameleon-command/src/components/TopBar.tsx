import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Bell, MoreHorizontal, User, Sun, Moon, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useJarvisStore } from '@/store/jarvisStore';
import { getSessionStatus, logout, type SessionStatus } from '@/lib/sessionApi';

// Theme toggle — kept from previous version
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
    <button onClick={toggle} title={isDark ? 'Light mode' : 'Dark mode'} className="j-topbar-icon-btn">
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}

// Teal hexagon brand mark
function BrandMark() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 22 22"
      style={{
        filter: 'drop-shadow(0 0 5px rgba(111,230,189,0.6))',
        marginRight: 10,
        flexShrink: 0,
      }}
    >
      <polygon
        points="11,1 21,6 21,16 11,21 1,16 1,6"
        fill="none"
        stroke="#6FE6BD"
        strokeWidth={1.5}
      />
    </svg>
  );
}

// Real account menu (hosted/managed mode, Phase 4 - khameleon-decisions-log.md,
// 2026-10-03). The old <User> icon here was decorative and unwired - a no-op
// for a no-accounts instance (renders the exact same inert icon it always
// did), a real dropdown once accounts mode is active.
function AccountMenu() {
  const setActiveTab = useJarvisStore(s => s.setActiveTab);
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { getSessionStatus().then(setSession).catch(() => {}); }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onClickOutside);
    return () => window.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (session?.mode !== 'accounts' || !session.user) {
    return (
      <button className="j-topbar-icon-btn" title="Account">
        <User size={14} />
      </button>
    );
  }

  const { user } = session;
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      window.location.reload();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="j-topbar-icon-btn" title={user.email} onClick={() => setOpen(v => !v)}>
        <User size={14} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, width: 220, zIndex: 200,
          background: 'rgba(8,14,24,0.98)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
          boxShadow: '0 12px 30px rgba(0,0,0,0.5)', overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontFamily: 'var(--j-font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--j-text)' }}>
              {user.displayName || user.email}{user.isAdmin ? ' · admin' : ''}
            </div>
            <div className="j-mono" style={{ fontSize: 10, color: 'var(--j-text-muted)', marginTop: 2 }}>{user.email}</div>
          </div>
          <button
            onClick={() => { setActiveTab('security'); setOpen(false); }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'none', border: 'none', color: 'var(--j-text-muted)', fontFamily: 'var(--j-font-ui)', fontSize: 11, cursor: 'pointer', textAlign: 'left' }}
          >
            <SettingsIcon size={12} /> Account settings
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)', color: 'var(--j-coral)', fontFamily: 'var(--j-font-ui)', fontSize: 11, cursor: 'pointer', textAlign: 'left', opacity: loggingOut ? 0.5 : 1 }}
          >
            <LogOut size={12} /> {loggingOut ? 'Logging out…' : 'Log out'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TopBar() {
  const setCommandPaletteOpen = useJarvisStore(s => s.setCommandPaletteOpen);
  return (
    <div className="j-topbar-slim">
      {/* ── Left: brand only; the deprecated Assistant/Workspace split is removed. ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1 }}>
        <BrandMark />
        <span style={{
          fontFamily: 'var(--j-font-head)',
          fontSize: 13,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.88)',
          letterSpacing: '0.02em',
          flexShrink: 0,
        }}>
          Khameleon
        </span>
      </div>

      {/* ── Right: icon actions ───────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="j-topbar-icon-btn" title="Search" onClick={() => setCommandPaletteOpen(true)}>
          <Search size={14} />
        </button>
        <button className="j-topbar-icon-btn" title="Notifications" style={{ position: 'relative' }}>
          <Bell size={14} />
          <span style={{
            position: 'absolute', top: 2, right: 2, width: 5, height: 5,
            background: 'var(--j-coral)', borderRadius: '50%',
          }} />
        </button>
        <button className="j-topbar-icon-btn" title="More">
          <MoreHorizontal size={14} />
        </button>
        <ThemeToggle />
        <AccountMenu />
      </div>
    </div>
  );
}
