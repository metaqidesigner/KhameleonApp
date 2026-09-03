import React from 'react';
import { Lock } from 'lucide-react';

interface SignalGlassPanelProps {
  title: string;
  icon?: React.ReactNode;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  bodyStyle?: React.CSSProperties;
  bodyVisible?: boolean;
  panelStyle?: React.CSSProperties;
  panelProps?: React.HTMLAttributes<HTMLDivElement>;
  headerProps?: React.HTMLAttributes<HTMLDivElement>;
  noPadding?: boolean;
}

export function SignalGlassPanel({
  title, icon, badge, action, children,
  className = '', headerClassName = '', bodyClassName = '', bodyStyle,
  headerProps, noPadding,
  panelStyle, panelProps, bodyVisible = true,
}: SignalGlassPanelProps) {
  const { className: headerExtraClass = '', style: headerStyle, ...restHeaderProps } = headerProps ?? {};
  const isLive = badge === 'LIVE';

  return (
    <div {...panelProps} className={`j-panel ${className}`.trim()} style={panelStyle}>
      <div
        {...restHeaderProps}
        {...(headerStyle ? { style: headerStyle } : {})}
        className={`j-panel-header ${headerClassName} ${headerExtraClass}`.trim()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {icon && <span style={{ color: 'rgba(196,212,236,0.45)', display: 'flex' }}>{icon}</span>}
          <span className="j-panel-heading">{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {action}
          {isLive ? (
            <span className="j-panel-live"><span className="j-panel-live-dot" />Live</span>
          ) : badge ? (
            <span className="j-panel-badge"><Lock size={9} />{badge.charAt(0) + badge.slice(1).toLowerCase()}</span>
          ) : null}
        </div>
      </div>
      {bodyVisible && (
        <div className={`j-panel-body ${bodyClassName}`.trim()} style={noPadding ? { padding: 0, ...bodyStyle } : bodyStyle}>
          {children}
        </div>
      )}
    </div>
  );
}
