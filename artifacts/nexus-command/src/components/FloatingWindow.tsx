import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type CanvasZone = 'left' | 'centre' | 'right';

interface FloatingWindowProps {
  icon?: React.ReactNode;
  label: string;
  badge?: string;
  /** When true, the window visually "lifts" toward focus (animated). */
  focused?: boolean;
  /** Fill remaining column height */
  grow?: boolean;
  defaultMinimized?: boolean;
  children: React.ReactNode;
}

/**
 * Reusable glass window for the unified canvas.
 * Zone placement is handled by the column it renders in; the `focused`
 * state animates the window toward the viewer (transform transition ~400ms)
 * so status changes are visibly animated, not instant jumps.
 */
export function FloatingWindow({
  icon, label, badge, focused = false, grow = false, defaultMinimized = false, children,
}: FloatingWindowProps) {
  const [minimized, setMinimized] = useState(defaultMinimized);

  return (
    <div
      className={`kc-window${focused ? ' kc-window-focused' : ''}${minimized ? ' kc-window-min' : ''}`}
      style={grow && !minimized ? { flex: '1 1 0', minHeight: 0 } : undefined}
    >
      <div className="kc-window-titlebar">
        {icon && <span className="kc-window-icon">{icon}</span>}
        <span className="kc-window-label">{label}</span>
        {badge && <span className="kc-window-badge">{badge}</span>}
        <button
          className="kc-window-minbtn"
          title={minimized ? 'Expand' : 'Minimize'}
          onClick={() => setMinimized(m => !m)}
        >
          {minimized ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>
      {!minimized && <div className="kc-window-body">{children}</div>}
    </div>
  );
}
