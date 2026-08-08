import React from 'react';
import { Lock } from 'lucide-react';

interface JPanelProps {
  title: string;
  icon?: React.ReactNode;
  badge?: string;
  action?: React.ReactNode;
  /** @deprecated no longer used — all panels share the same glass style */
  headerVariant?: 'red' | 'amber';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  noPadding?: boolean;
}

export default function JPanel({
  title, icon, badge = 'CLASSIFIED', action,
  children, className = '', style, noPadding,
}: JPanelProps) {
  const isLive = badge === 'LIVE';

  return (
    <div
      className={`j-panel ${className}`}
      style={style}
    >
      {/* ── Header ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '13px 16px 11px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && (
            <span style={{ color: 'rgba(196,212,236,0.45)', display: 'flex' }}>
              {icon}
            </span>
          )}
          <span style={{
            fontFamily: 'var(--j-font-ui)',
            fontSize: 14,
            fontWeight: 600,
            color: '#fff',
            letterSpacing: '0.01em',
          }}>
            {title}
          </span>
        </div>

        {/* Right side: actions + badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {action}

          {isLive ? (
            /* Live badge — green dot */
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontFamily: 'var(--j-font-ui)', fontSize: 11, fontWeight: 500,
              color: 'var(--j-green)',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: 'var(--j-green)',
                boxShadow: '0 0 6px var(--j-green)',
                animation: 'jarvis-pulse 2s ease-in-out infinite',
              }} />
              Live
            </span>
          ) : badge ? (
            /* Classified badge — amber lock pill */
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontFamily: 'var(--j-font-ui)', fontSize: 10, fontWeight: 600,
              color: 'var(--j-amber)',
              background: 'rgba(226,170,52,0.12)',
              border: '1px solid rgba(226,170,52,0.28)',
              borderRadius: 10,
              padding: '2px 8px',
              letterSpacing: '0.04em',
            }}>
              <Lock size={9} />
              {badge.charAt(0) + badge.slice(1).toLowerCase()}
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Body ── */}
      <div
        className="j-panel-body scrollbar-jarvis"
        style={noPadding ? { padding: 0 } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
