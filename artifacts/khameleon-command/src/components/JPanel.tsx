import React from 'react';
import { SignalGlassPanel } from './SignalGlassPanel';

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
  return (
    <SignalGlassPanel
      title={title}
      icon={icon}
      badge={badge}
      action={action}
      className={className}
      bodyClassName="scrollbar-jarvis"
      panelStyle={style}
      noPadding={noPadding}
    >
      {children}
    </SignalGlassPanel>
  );
}
