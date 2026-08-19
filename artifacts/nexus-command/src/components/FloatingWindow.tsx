import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useJarvisStore } from '@/store/jarvisStore';

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
  /**
   * When provided, minimised state is persisted in the Zustand store
   * (keyed by this id) so it survives page refreshes.
   */
  windowId?: string;
  children: React.ReactNode;
}

/**
 * Reusable glass window for the unified canvas.
 * Zone placement is handled by the column it renders in; the `focused`
 * state animates the window toward the viewer (transform transition ~400ms)
 * so status changes are visibly animated, not instant jumps.
 *
 * When `windowId` is supplied the minimised state is persisted via the
 * 'jarvis-ui' Zustand store so it survives page refreshes.
 */
export function FloatingWindow({
  icon, label, badge, focused = false, grow = false,
  defaultMinimized = false, windowId, children,
}: FloatingWindowProps) {
  // Persisted path — only used when windowId is provided
  const stored = useJarvisStore(s =>
    windowId !== undefined ? s.canvasWindowsMinimized[windowId] : undefined,
  );
  const setCanvasWindowMinimized = useJarvisStore(s => s.setCanvasWindowMinimized);

  // Local fallback (no windowId) — keeps the component self-contained
  const [localMinimized, setLocalMinimized] = useState(defaultMinimized);

  const minimized = windowId !== undefined
    ? (stored ?? defaultMinimized)
    : localMinimized;

  const setMinimized = (v: boolean) => {
    if (windowId !== undefined) {
      setCanvasWindowMinimized(windowId, v);
    } else {
      setLocalMinimized(v);
    }
  };

  return (
    <div
      className={`kc-window${windowId ? ` kc-window-${windowId}` : ''}${focused ? ' kc-window-focused' : ''}${minimized ? ' kc-window-min' : ''}`}
      style={grow && !minimized ? { flex: '1 1 0', minHeight: 0 } : undefined}
    >
      <div className="kc-window-titlebar">
        {icon && <span className="kc-window-icon">{icon}</span>}
        <span className="kc-window-label">{label}</span>
        {badge && <span className="kc-window-badge">{badge}</span>}
        <button
          className="kc-window-minbtn"
          title={minimized ? 'Expand' : 'Minimize'}
          onClick={() => setMinimized(!minimized)}
        >
          {minimized ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>
      {!minimized && <div className="kc-window-body">{children}</div>}
    </div>
  );
}
