import { Search, Bell, Settings, } from 'lucide-react';
import { useJarvisHealth, useGetCurrentMode } from '@/hooks/useJarvis';
import { useJarvisStore } from '@/store/jarvisStore';

export function TopBar() {
  const { data: health } = useJarvisHealth();
  const { data: mode } = useGetCurrentMode();
  const { setCommandPaletteOpen, setActiveModule } = useJarvisStore();

  const status = health?.status ?? 'offline';
  const isOnline = status === 'online';

  return (
    <div style={{
      height: 40,
      background: '#161b22',
      borderBottom: '1px solid #30363d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      gap: 12,
      flexShrink: 0,
    }}>
      {/* Left — wordmark + mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          fontWeight: 600,
          color: '#58a6ff',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}>
          ⬡ JARVIS
        </span>
        {mode?.name && (
          <span style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: '#8b949e',
            background: '#21262d',
            border: '1px solid #30363d',
            borderRadius: 10,
            padding: '1px 7px',
            whiteSpace: 'nowrap',
          }}>
            {mode.name}
          </span>
        )}
      </div>

      {/* Center — command palette trigger */}
      <button
        onClick={() => setCommandPaletteOpen(true)}
        style={{
          flex: 1,
          maxWidth: 400,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#21262d',
          border: '1px solid #30363d',
          borderRadius: 4,
          padding: '0 10px',
          cursor: 'text',
          color: '#484f58',
          fontSize: 12,
          fontFamily: 'var(--font-ui)',
        }}
      >
        <Search style={{ width: 13, height: 13, flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: 'left' }}>Search or ask Jarvis...</span>
        <kbd style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: '#484f58',
          background: '#0d1117',
          border: '1px solid #30363d',
          borderRadius: 3,
          padding: '0 5px',
          lineHeight: '18px',
        }}>⌘K</kbd>
      </button>

      {/* Right — engine + status + icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {/* Engine badge */}
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: '#8b949e',
          whiteSpace: 'nowrap',
        }}>
          {health?.engine && health.engine !== 'none' && health.engine !== 'offline'
            ? `${health.engine} · ${health.model}`
            : 'no engine'}
        </span>

        <span style={{ width: 1, height: 14, background: '#30363d', flexShrink: 0 }} />

        {/* Status dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: isOnline ? '#3fb950' : status === 'degraded' ? '#d29922' : '#f85149',
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: isOnline ? '#3fb950' : status === 'degraded' ? '#d29922' : '#f85149',
          }}>
            {status}
          </span>
        </div>

        <span style={{ width: 1, height: 14, background: '#30363d', flexShrink: 0 }} />

        {/* Bell */}
        <button
          style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          onClick={() => {}}
        >
          <Bell style={{ width: 15, height: 15 }} />
        </button>

        {/* Settings */}
        <button
          style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          onClick={() => setActiveModule('settings')}
        >
          <Settings style={{ width: 15, height: 15 }} />
        </button>

        {/* Avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: '#21262d',
          border: '1px solid #30363d',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontFamily: 'var(--font-mono)', color: '#8b949e',
          flexShrink: 0,
        }}>
          JV
        </div>
      </div>
    </div>
  );
}
