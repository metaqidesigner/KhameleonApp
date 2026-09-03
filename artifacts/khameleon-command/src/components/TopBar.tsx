import React, { useState, useEffect, useCallback } from 'react';
import { Search, Bell, MoreHorizontal, User, Sun, Moon } from 'lucide-react';
import { useJarvisStore } from '@/store/jarvisStore';

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
        <button className="j-topbar-icon-btn" title="Account">
          <User size={14} />
        </button>
      </div>
    </div>
  );
}
