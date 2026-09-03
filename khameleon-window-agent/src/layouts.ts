import { Bounds, LayoutPreset } from "./types";

/**
 * Pure layout math: given a screen work area and a preset, compute the
 * target window bounds. No Electron, no OS calls — fully unit-testable.
 */
export function computeLayout(
  preset: LayoutPreset,
  screenArea: Bounds,
  marginPx = 16
): Bounds {
  const { x, y, width, height } = screenArea;

  switch (preset) {
    case "enlarged": {
      const w = Math.round(width * 0.7);
      const h = Math.round(height * 0.8);
      return {
        x: x + Math.round((width - w) / 2),
        y: y + Math.round((height - h) / 2),
        width: w,
        height: h,
      };
    }

    case "docked-right": {
      const w = Math.round(width * 0.3);
      const h = height - marginPx * 2;
      return {
        x: x + width - w - marginPx,
        y: y + marginPx,
        width: w,
        height: h,
      };
    }

    case "docked-left": {
      const w = Math.round(width * 0.3);
      const h = height - marginPx * 2;
      return {
        x: x + marginPx,
        y: y + marginPx,
        width: w,
        height: h,
      };
    }

    case "corner": {
      const w = Math.round(width * 0.18);
      const h = Math.round(height * 0.18);
      return {
        x: x + width - w - marginPx,
        y: y + height - h - marginPx,
        width: w,
        height: h,
      };
    }

    default: {
      // Exhaustiveness check: TS will error here if a LayoutPreset case is unhandled.
      const _exhaustive: never = preset;
      throw new Error(`Unknown layout preset: ${_exhaustive}`);
    }
  }
}
