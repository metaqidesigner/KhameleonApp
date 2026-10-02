import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatWindowBounds } from './types';

/**
 * Real pointer-event-based free drag + resize for an in-page floating
 * panel. Written fresh (2026-10-02) - neither existing "window" system in
 * this repo fits: FloatingWindow.tsx only reorders tiles between fixed
 * zones (no free x/y, no resize), and khameleon-window-agent controls
 * real OS windows via Electron + node-window-manager, a different layer
 * entirely. See khameleon-decisions-log.md, 2026-10-02.
 */

export const MIN_WIDTH = 340;
export const MIN_HEIGHT = 380;
export const RAIL_SNAP_THRESHOLD = 90; // px from the right edge of the viewport

export interface UseWindowDragResult {
  bounds: ChatWindowBounds;
  isDragging: boolean;
  isResizing: boolean;
  showRailDropZone: boolean;
  startDrag: (event: React.PointerEvent) => void;
  startResize: (event: React.PointerEvent) => void;
}

/** Pure, exported for direct unit testing - no DOM/pointer simulation needed. */
export function clampToViewport(next: ChatWindowBounds, viewportWidth: number, viewportHeight: number): ChatWindowBounds {
  const maxX = viewportWidth - 80;
  const maxY = viewportHeight - 60;
  return { ...next, x: Math.min(Math.max(next.x, -next.width + 120), maxX), y: Math.min(Math.max(next.y, 0), maxY) };
}

/** Pure, exported for direct unit testing. */
export function isNearRailDropZone(bounds: ChatWindowBounds, viewportWidth: number): boolean {
  return viewportWidth - (bounds.x + bounds.width) < RAIL_SNAP_THRESHOLD;
}

/** Pure, exported for direct unit testing. */
export function resizedBounds(start: { width: number; height: number }, dx: number, dy: number): { width: number; height: number } {
  return { width: Math.max(MIN_WIDTH, start.width + dx), height: Math.max(MIN_HEIGHT, start.height + dy) };
}

export function useWindowDrag(
  initialBounds: ChatWindowBounds,
  onSettle: (bounds: ChatWindowBounds) => void,
  onDockRequested: () => void,
): UseWindowDragResult {
  const [bounds, setBounds] = useState<ChatWindowBounds>(initialBounds);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [showRailDropZone, setShowRailDropZone] = useState(false);
  const dragStart = useRef({ pointerX: 0, pointerY: 0, boundsX: 0, boundsY: 0 });
  const resizeStart = useRef({ pointerX: 0, pointerY: 0, width: 0, height: 0 });

  useEffect(() => { setBounds(initialBounds); }, [initialBounds.x, initialBounds.y, initialBounds.width, initialBounds.height]);

  const startDrag = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, boundsX: bounds.x, boundsY: bounds.y };
    setIsDragging(true);
  }, [bounds.x, bounds.y]);

  const startResize = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    resizeStart.current = { pointerX: event.clientX, pointerY: event.clientY, width: bounds.width, height: bounds.height };
    setIsResizing(true);
  }, [bounds.width, bounds.height]);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (event: PointerEvent) => {
      const dx = event.clientX - dragStart.current.pointerX;
      const dy = event.clientY - dragStart.current.pointerY;
      const next = clampToViewport({ ...bounds, x: dragStart.current.boundsX + dx, y: dragStart.current.boundsY + dy }, window.innerWidth, window.innerHeight);
      setBounds(next);
      setShowRailDropZone(isNearRailDropZone(next, window.innerWidth));
    };
    const onUp = () => {
      setIsDragging(false);
      if (showRailDropZone) {
        onDockRequested();
      } else {
        onSettle(bounds);
      }
      setShowRailDropZone(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (event: PointerEvent) => {
      const dx = event.clientX - resizeStart.current.pointerX;
      const dy = event.clientY - resizeStart.current.pointerY;
      setBounds(b => ({ ...b, ...resizedBounds(resizeStart.current, dx, dy) }));
    };
    const onUp = () => {
      setIsResizing(false);
      setBounds(b => { onSettle(b); return b; });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizing]);

  return { bounds, isDragging, isResizing, showRailDropZone, startDrag, startResize };
}
