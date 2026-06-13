import React, { useState, useEffect } from 'react';
import { Bell, Settings } from 'lucide-react';
import { useJarvisStore, type TabId } from '@/store/jarvisStore';
import { useJarvisHealth, useGetCurrentMode } from '@/hooks/useJarvis';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview',   label: 'OVERVIEW' },
  { id: 'agents',     label: 'AGENTS' },
  { id: 'research',   label: 'RESEARCH' },
  { id: 'memory',     label: 'MEMORY' },
  { id: 'comms',      label: 'COMMS' },
  { id: 'analytics',  label: 'ANALYTICS' },
  { id: 'security',   label: 'SECURITY' },
  { id: 'vault',      label: 'VAULT' },
  { id: 'skills',     label: 'SKILLS' },
  { id: 'settings',   label: 'SETTINGS' },
];

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
    <span style={{ fontFamily: 'var(--j-font-mono)', fontSize: 13, color: 'var(--j-cyan)', letterSpacing: '0.08em' }}>
      {d} {t}
    </span>
  );
}

export default function TopBar() {
  const { activeTab, setActiveTab, setCommandPaletteOpen } = useJarvisStore();
  const { data: health } = useJarvisHealth();
  const { data: mode } = useGetCurrentMode();

  const isOnline = health?.status !== 'offline' && health != null;
  const engine = health?.engine ?? 'OFFLINE';
  const model  = health?.model  ?? '—';

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
      background: 'rgba(0,4,8,0.97)',
      borderBottom: '1px solid rgba(0,212,255,0.28)',
      boxShadow: '0 2px 20px rgba(0,212,255,0.12)',
      display: 'flex', alignItems: 'stretch',
      position: 'relative', zIndex: 20,
    }}>
      {/* Left */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'0 16px', borderRight:'1px solid rgba(0,212,255,0.12)', flexShrink:0 }}>
        <div style={{ display:'flex', gap:4 }}>
          {[0,80,160].map(delay => (
            <div key={delay} style={{ width:6, height:6, borderRadius:'50%', background:'var(--j-cyan)', animation:`jarvis-pulse 1.8s ease-in-out ${delay}ms infinite` }} />
          ))}
        </div>
        <span style={{ fontFamily:'var(--j-font-head)', fontSize:15, fontWeight:700, color:'var(--j-cyan)', letterSpacing:'0.32em', animation:'jarvis-flicker 10s linear infinite' }}>
          J.A.R.V.I.S
        </span>
        <span style={{ color:'rgba(0,212,255,0.22)', fontSize:20 }}>|</span>
        <span className="j-badge j-badge-cyan" style={{ fontFamily:'var(--j-font-mono)', fontSize:10 }}>
          {(mode?.name ?? 'WORK').toUpperCase()} MODE
        </span>
      </div>

      {/* Center tabs */}
      <div style={{ flex:1, display:'flex', alignItems:'stretch', overflowX:'auto' }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              height:'100%', padding:'0 13px',
              background: active ? 'rgba(0,212,255,0.06)' : 'transparent',
              border:'none',
              borderBottom: active ? '2px solid var(--j-cyan)' : '2px solid transparent',
              color: active ? 'var(--j-cyan)' : 'var(--j-text-muted)',
              fontFamily:'var(--j-font-ui)', fontSize:12, fontWeight:600,
              textTransform:'uppercase', letterSpacing:'0.15em',
              cursor:'pointer', whiteSpace:'nowrap',
              transition:'color 0.15s, background 0.15s',
              flexShrink:0,
            }}>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Right */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 12px', borderLeft:'1px solid rgba(0,212,255,0.12)', flexShrink:0 }}>
        <LiveClock />
        <span style={{ color:'rgba(0,212,255,0.2)', fontSize:18 }}>|</span>
        <span style={{ fontFamily:'var(--j-font-mono)', fontSize:11, color:'var(--j-text-muted)', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>
          <span style={{ color: isOnline ? 'var(--j-green)' : 'var(--j-red)' }}>●</span>{' '}
          {engine.toUpperCase()} · {model.toUpperCase()}
        </span>
        <span style={{ color:'rgba(0,212,255,0.2)', fontSize:18 }}>|</span>
        <button onClick={() => setCommandPaletteOpen(true)} style={{ background:'rgba(0,212,255,0.08)', border:'1px solid rgba(0,212,255,0.2)', color:'var(--j-text-muted)', fontFamily:'var(--j-font-mono)', fontSize:10, padding:'3px 8px', cursor:'pointer', letterSpacing:'0.06em' }}>
          ⌘K
        </button>
        <button style={{ background:'none', border:'none', cursor:'pointer', color:'var(--j-text-muted)', padding:0, position:'relative' }}>
          <Bell size={16} />
          <span style={{ position:'absolute', top:-4, right:-4, width:14, height:14, background:'var(--j-red)', borderRadius:'50%', fontFamily:'var(--j-font-mono)', fontSize:8, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>3</span>
        </button>
        <button onClick={() => setActiveTab('settings')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--j-text-muted)', padding:0 }}>
          <Settings size={15} />
        </button>
      </div>
    </div>
  );
}
