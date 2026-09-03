import React, { useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useJarvisStore } from '@/store/jarvisStore';

export type CanvasZone = 'left' | 'centre' | 'right';
export type WindowDropPlacement = 'before' | 'after';
export const FLOATING_WINDOW_DRAG_TYPE = 'application/x-khameleon-canvas-window';

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
  /**
   * Enables title-bar drag and accepts another canvas window dropped on this
   * window. The parent owns the actual position update.
   */
  onWindowDrop?: (draggedWindowId: string, targetWindowId: string, placement: WindowDropPlacement) => void;
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
  defaultMinimized = false, windowId, onWindowDrop, children,
}: FloatingWindowProps) {
  // Persisted path — only used when windowId is provided
  const stored = useJarvisStore(s =>
    windowId !== undefined ? s.canvasWindowsMinimized[windowId] : undefined,
  );
  const setCanvasWindowMinimized = useJarvisStore(s => s.setCanvasWindowMinimized);

  // Local fallback (no windowId) — keeps the component self-contained
  const [localMinimized, setLocalMinimized] = useState(defaultMinimized);
  const [isDragging, setIsDragging] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const dragDepth = useRef(0);

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

  const draggable = Boolean(windowId && onWindowDrop);

  const getDraggedWindowId = (event: React.DragEvent) =>
    event.dataTransfer.getData(FLOATING_WINDOW_DRAG_TYPE);

  const isCanvasWindowDrag = (event: React.DragEvent) =>
    event.dataTransfer.types.includes(FLOATING_WINDOW_DRAG_TYPE);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    if (!windowId) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(FLOATING_WINDOW_DRAG_TYPE, windowId);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    dragDepth.current = 0;
    setIsDragging(false);
    setIsDropTarget(false);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onWindowDrop || !windowId || !isCanvasWindowDrag(event)) return;
    dragDepth.current += 1;
    setIsDropTarget(true);
  };

  const handleDragLeave = () => {
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDropTarget(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onWindowDrop || !windowId || !isCanvasWindowDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const draggedWindowId = getDraggedWindowId(event);
    dragDepth.current = 0;
    setIsDropTarget(false);
    if (!onWindowDrop || !windowId || !draggedWindowId || draggedWindowId === windowId) return;

    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const placement: WindowDropPlacement =
      event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    onWindowDrop(draggedWindowId, windowId, placement);
  };

  return (
    <div
      className={`kc-window${windowId ? ` kc-window-${windowId}` : ''}${focused ? ' kc-window-focused' : ''}${minimized ? ' kc-window-min' : ''}${isDragging ? ' kc-window-dragging' : ''}${isDropTarget ? ' kc-window-drop-target' : ''}`}
      style={grow && !minimized ? { flex: '1 1 0', minHeight: 0 } : undefined}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className={`kc-window-titlebar${draggable ? ' kc-window-drag-handle' : ''}`}
        draggable={draggable}
        title={draggable ? 'Drag to rearrange this window' : undefined}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {icon && <span className="kc-window-icon">{icon}</span>}
        <span className="kc-window-label">{label}</span>
        {badge && <span className="kc-window-badge">{badge}</span>}
        <button
          className="kc-window-minbtn"
          title={minimized ? 'Expand' : 'Minimize'}
          draggable={false}
          onDragStart={event => event.preventDefault()}
          onClick={() => setMinimized(!minimized)}
        >
          {minimized ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>
      {!minimized && <div className="kc-window-body">{children}</div>}
    </div>
  );
}
