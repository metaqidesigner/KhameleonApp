import { Bounds } from "./types";

export type Easing = (t: number) => number;

/** Smooth accelerate-then-decelerate curve — the "shrink and glide aside" feel. */
export const easeInOutCubic: Easing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function interpolateBounds(
  from: Bounds,
  to: Bounds,
  t: number,
  easing: Easing = easeInOutCubic
): Bounds {
  const e = easing(Math.min(1, Math.max(0, t)));
  return {
    x: Math.round(from.x + (to.x - from.x) * e),
    y: Math.round(from.y + (to.y - from.y) * e),
    width: Math.round(from.width + (to.width - from.width) * e),
    height: Math.round(from.height + (to.height - from.height) * e),
  };
}

export interface AnimateBoundsOptions {
  from: Bounds;
  to: Bounds;
  durationMs: number;
  onTick: (bounds: Bounds) => void;
  onDone?: () => void;
  easing?: Easing;
  /** Frame interval in ms. Defaults to ~60fps. */
  frameMs?: number;
  /** Injectable clock/scheduler, so this is testable without real timers. */
  now?: () => number;
  schedule?: (cb: () => void, ms: number) => unknown;
  clear?: (handle: unknown) => void;
}

/**
 * Drives a window's bounds from `from` to `to` over `durationMs`, calling
 * `onTick` on every frame. This is what makes "move aside" look like a
 * smooth glide-and-shrink instead of an instant jump — same idea IRIS-AI
 * uses GSAP/Framer Motion for on DOM elements, applied to native OS window
 * bounds instead.
 *
 * Platform-agnostic on purpose: works identically whether onTick calls
 * Electron's BrowserWindow.setBounds or node-window-manager's
 * Window.setBounds.
 */
export function animateBounds(opts: AnimateBoundsOptions): { cancel: () => void } {
  const {
    from,
    to,
    durationMs,
    onTick,
    onDone,
    easing = easeInOutCubic,
    frameMs = 1000 / 60,
    now = () => Date.now(),
    schedule = (cb, ms) => setTimeout(cb, ms),
    clear = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  } = opts;

  if (durationMs <= 0) {
    onTick(to);
    onDone?.();
    return { cancel: () => {} };
  }

  const start = now();
  let handle: unknown;
  let cancelled = false;

  const tick = () => {
    if (cancelled) return;
    const elapsed = now() - start;
    const t = Math.min(1, elapsed / durationMs);
    onTick(interpolateBounds(from, to, t, easing));

    if (t >= 1) {
      onDone?.();
      return;
    }
    handle = schedule(tick, frameMs);
  };

  // Paint the starting frame synchronously so there's no blank/laggy first
  // frame, then schedule subsequent frames on the normal interval.
  onTick(from);
  handle = schedule(tick, frameMs);

  return {
    cancel: () => {
      cancelled = true;
      if (handle !== undefined) clear(handle);
    },
  };
}
