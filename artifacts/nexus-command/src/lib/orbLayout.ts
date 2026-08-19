export const ORB_SIZE = 90;
export const ORB_SIZE_MIN = 48;
export const ORB_RIGHT_OFFSET = 44;
export const ORB_BOTTOM_OFFSET = 40;
export const FOCUS_CARD_LEFT = 60;
export const FOCUS_CARD_BOTTOM = 28;
export const FOCUS_CARD_WIDTH = 76;

export interface LayoutRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getDefaultOrbPosition(
  viewportWidth: number,
  viewportHeight: number,
  size = ORB_SIZE,
): { x: number; y: number } {
  return {
    x: viewportWidth - size - ORB_RIGHT_OFFSET,
    y: viewportHeight - size - ORB_BOTTOM_OFFSET,
  };
}

/**
 * The focus card uses border-box sizing and is intentionally kept in the
 * bottom-left safe area. Its height is only needed for geometry checks; the
 * horizontal gap is the primary separation from the bottom-right orb.
 */
export function getFocusCardRect(viewportHeight: number, height = 100): LayoutRect {
  return {
    left: FOCUS_CARD_LEFT,
    top: viewportHeight - FOCUS_CARD_BOTTOM - height,
    width: FOCUS_CARD_WIDTH,
    height,
  };
}

export function getOrbRect(
  viewportWidth: number,
  viewportHeight: number,
  size = ORB_SIZE,
): LayoutRect {
  const { x, y } = getDefaultOrbPosition(viewportWidth, viewportHeight, size);
  return { left: x, top: y, width: size, height: size };
}

export function rectsOverlap(a: LayoutRect, b: LayoutRect): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}