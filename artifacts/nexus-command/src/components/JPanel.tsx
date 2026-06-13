import React from 'react';
import { useJarvisStore } from '@/store/jarvisStore';

interface JPanelProps {
  title: string;
  icon?: React.ReactNode;
  badge?: string;
  headerVariant?: 'red' | 'amber';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  noPadding?: boolean;
}

export default function JPanel({
  title, icon, badge = 'CLASSIFIED', headerVariant = 'red',
  children, className = '', style, noPadding,
}: JPanelProps) {
  const corners = useJarvisStore(s => s.cornerBracketsEnabled);

  return (
    <div
      className={`j-panel ${corners ? 'j-corner' : ''} ${className}`}
      style={style}
    >
      <div className={`j-panel-header ${headerVariant === 'amber' ? 'j-panel-header-amber' : ''}`}>
        <span className="j-panel-title">
          {icon && <span style={{ color: 'var(--j-red)', display: 'flex' }}>{icon}</span>}
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="j-badge-classified">{badge}</span>
          <button
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}
            title="Close"
            onClick={() => {}}
          >×</button>
        </div>
      </div>
      <div
        className={`j-panel-body scrollbar-jarvis ${noPadding ? '' : ''}`}
        style={noPadding ? { padding: 0 } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
