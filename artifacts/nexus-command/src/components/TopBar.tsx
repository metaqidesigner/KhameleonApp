import React, { useState, useEffect, useCallback } from 'react';
import { Search, Bell, MoreHorizontal, User, Sun, Moon } from 'lucide-react';

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

// Thin cursor/pipe brand mark
function BrandPipe() {
  return (
    <span style={{
      display: 'inline-block', width: 2, height: 18,
      background: 'rgba(255,255,255,0.35)',
      borderRadius: 1, marginRight: 10, flexShrink: 0,
    }} />
  );
}

export default function TopBar() {
  return (
    <div className="j-topbar-slim">
      {/* ── Left: brand + nav ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1 }}>
        <BrandPipe />
        <span style={{
          fontFamily: 'var(--j-font-head)',
          fontSize: 13,
          fontWeight: 700,
          color: 'rgba(255,255,255,0.88)',
          letterSpacing: '0.14em',
          marginRight: 20,
          flexShrink: 0,
        }}>
          Khameleon
        </span>
      </div>

      {/* ── Right: icon actions ───────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="j-topbar-icon-btn" title="Search">
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
