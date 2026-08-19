export const ORB_SIZE = 90;
export const ORB_SIZE_MIN = 48;
/**
 * The glow grows 35px beyond the full-size container at its breathing peak.
 * This extra buffer also covers the arcs and soft core shadows.
 */
export const ORB_VISUAL_OVERFLOW = 40;
export const ORB_RIGHT_OFFSET = 44;
export const ORB_BOTTOM_OFFSET = 40;
export const FOCUS_CARD_LEFT = 60;
export const FOCUS_CARD_BOTTOM = 28;
export const FOCUS_CARD_WIDTH = 76;
export const FOCUS_CARD_HEIGHT = 100;

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
  return clampOrbPosition(
    viewportWidth - size - ORB_RIGHT_OFFSET,
    viewportHeight - size - ORB_BOTTOM_OFFSET,
    viewportWidth,
    viewportHeight,
    size,
  );
}

/**
 * The focus card uses border-box sizing and is intentionally kept in the
 * bottom-left safe area. Its height is only needed for geometry checks; the
 * horizontal gap is the primary separation from the bottom-right orb.
 */
export function getFocusCardRect(viewportHeight: number, height = FOCUS_CARD_HEIGHT): LayoutRect {
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

export function getOrbVisualRect(
  x: number,
  y: number,
  size = ORB_SIZE,
  overflow = ORB_VISUAL_OVERFLOW,
): LayoutRect {
  return {
    left: x - overflow,
    top: y - overflow,
    width: size + overflow * 2,
    height: size + overflow * 2,
  };
}

export function rectsOverlap(a: LayoutRect, b: LayoutRect): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

function clampToViewport(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  size: number,
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, Math.max(0, viewportWidth - size))),
    y: Math.max(0, Math.min(y, Math.max(0, viewportHeight - size))),
  };
}

/**
 * Keeps the orb inside the viewport and out of the focus card's protected
 * area. When a drag enters the card, the nearest valid edge is selected so
 * the orb still follows the pointer naturally instead of jumping to a fixed
 * corner.
 */
export function clampOrbPosition(
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number,
  size = ORB_SIZE,
  protectedRect = getFocusCardRect(viewportHeight),
): { x: number; y: number } {
  const bounded = clampToViewport(x, y, viewportWidth, viewportHeight, size);
  const orbRect = getOrbVisualRect(bounded.x, bounded.y, size);

  if (!rectsOverlap(orbRect, protectedRect)) return bounded;

  const candidates = [
    // Keep the pointer's vertical position and move past the card horizontally.
    { x: protectedRect.left + protectedRect.width + ORB_VISUAL_OVERFLOW, y: bounded.y },
    { x: protectedRect.left - size - ORB_VISUAL_OVERFLOW, y: bounded.y },
    // Keep the pointer's horizontal position and move above/below the card.
    { x: bounded.x, y: protectedRect.top - size - ORB_VISUAL_OVERFLOW },
    { x: bounded.x, y: protectedRect.top + protectedRect.height + ORB_VISUAL_OVERFLOW },
  ].map(candidate => clampToViewport(
    candidate.x,
    candidate.y,
    viewportWidth,
    viewportHeight,
    size,
  )).filter(candidate => !rectsOverlap(
    getOrbVisualRect(candidate.x, candidate.y, size),
    protectedRect,
  ));

  if (candidates.length === 0) return bounded;

  return candidates.reduce((nearest, candidate) => {
    const nearestDistance = (nearest.x - bounded.x) ** 2 + (nearest.y - bounded.y) ** 2;
    const candidateDistance = (candidate.x - bounded.x) ** 2 + (candidate.y - bounded.y) ** 2;
    return candidateDistance < nearestDistance ? candidate : nearest;
  });
}