import { useState, useEffect, useRef } from 'react';
import { Bell, Settings, Activity, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useJarvisHealth, useGetCurrentMode } from '@/hooks/useJarvis';
import { useNexusStore } from '@/store/nexusStore';

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface TopBarProps {
  onOpenSettings: () => void;
  showSettings: boolean;
}

export function TopBar({ onOpenSettings, showSettings }: TopBarProps) {
  const { data: health } = useJarvisHealth();
  const { data: currentMode } = useGetCurrentMode({ query: { queryKey: ['currentMode'] } });
  const agentHistory = useNexusStore(s => s.agentHistory);

  const [uptime, setUptime] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // tick uptime locally once we get it from health
  useEffect(() => {
    if (health?.uptime !== undefined) setUptime(health.uptime);
  }, [health?.uptime]);

  useEffect(() => {
    const id = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // close notif dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const status = health?.status ?? 'offline';
  const isOnline = status === 'online';
  const isDegraded = status === 'degraded';

  const healthPillClass = isOnline
    ? 'nexus-pill nexus-pill-green'
    : isDegraded
    ? 'nexus-pill nexus-pill-amber'
    : 'nexus-pill nexus-pill-red';

  const healthLabel = isOnline
    ? `${health?.engine?.toUpperCase() ?? 'JARVIS'} · ${health?.model ?? '—'}`
    : isDegraded
    ? 'DEGRADED'
    : 'OFFLINE — CHECK BACKEND';

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 54, zIndex: 50,
      background: 'rgba(2,8,16,0.88)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(0,212,255,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%', background: '#00d4ff',
          boxShadow: '0 0 8px #00d4ff, 0 0 18px rgba(0,212,255,0.5)',
          animation: 'nexus-pulse 2.4s ease-in-out infinite',
        }} />
        <span style={{ color: '#00d4ff', fontWeight: 800, fontSize: 14, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
          NEXUS COMMAND
        </span>
        <span style={{ fontSize: 10, color: 'rgba(0,212,255,0.35)', fontFamily: 'var(--font-mono)', marginLeft: 4, letterSpacing: '0.12em' }}>
          ⌘K to command
        </span>
      </div>

      {/* Status pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div className="nexus-pill nexus-pill-cyan">
          <span className="nexus-dot nexus-dot-cyan" />
          <span>{currentMode?.name?.toUpperCase() || 'WORK MODE'}</span>
        </div>

        <div className={healthPillClass}>
          {isOnline ? (
            <Activity style={{ width: 11, height: 11 }} />
          ) : (
            <WifiOff style={{ width: 11, height: 11 }} />
          )}
          <span>{healthLabel}</span>
        </div>

        {isOnline && (
          <div style={{ fontSize: 10, color: 'rgba(0,212,255,0.4)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
            UP {formatUptime(uptime)}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Notification bell */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            className="nexus-icon-btn"
            onClick={() => setNotifOpen(o => !o)}
            aria-label="Notifications"
          >
            <Bell style={{ width: 16, height: 16 }} />
            {agentHistory.length > 0 && (
              <span style={{
                position: 'absolute', top: 5, right: 5,
                width: 7, height: 7, borderRadius: '50%',
                background: '#ef4444', boxShadow: '0 0 6px #ef4444',
              }} />
            )}
          </button>

          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: 'absolute', top: 44, right: 0,
                  width: 340, maxHeight: 320, overflowY: 'auto',
                  background: 'rgba(2,10,22,0.97)', border: '1px solid rgba(0,212,255,0.18)',
                  borderRadius: 12, padding: '12px 0',
                  boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                  zIndex: 100,
                }}
                className="scrollbar-hide"
              >
                <div style={{ padding: '0 16px 10px', fontSize: 10, letterSpacing: '0.18em', color: 'rgba(0,212,255,0.5)', fontWeight: 600 }}>
                  AGENT HISTORY
                </div>
                {agentHistory.length === 0 ? (
                  <div style={{ padding: '12px 16px', color: 'rgba(130,170,200,0.5)', fontSize: 12 }}>
                    No recent activity
                  </div>
                ) : (
                  agentHistory.slice(0, 5).map(ev => (
                    <div key={ev.id} style={{ padding: '10px 16px', borderTop: '1px solid rgba(0,212,255,0.06)' }}>
                      <div style={{ fontSize: 11, color: 'rgba(0,212,255,0.7)', fontFamily: 'var(--font-mono)', marginBottom: 3 }}>
                        {ev.agent.toUpperCase()} · {new Date(ev.ts).toLocaleTimeString()}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(200,225,245,0.85)', lineHeight: 1.4 }}>
                        {ev.prompt.slice(0, 80)}{ev.prompt.length > 80 ? '…' : ''}
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={onOpenSettings}
          className={cn('nexus-icon-btn', showSettings && 'nexus-icon-btn-active')}
        >
          <Settings style={{ width: 16, height: 16 }} />
        </button>

        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(0,212,255,0.18), rgba(0,212,255,0.08))',
          border: '1px solid rgba(0,212,255,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#00d4ff', fontWeight: 700, fontSize: 11, letterSpacing: '0.05em' }}>EX</span>
        </div>
      </div>
    </div>
  );
}
