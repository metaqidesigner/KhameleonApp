import { describe, it, expect } from 'vitest';
import { clampToViewport, isNearRailDropZone, resizedBounds, MIN_WIDTH, MIN_HEIGHT } from './useWindowDrag';

describe('clampToViewport', () => {
  it('leaves bounds unchanged when well within the viewport', () => {
    const b = { x: 100, y: 100, width: 400, height: 600 };
    expect(clampToViewport(b, 1440, 900)).toEqual(b);
  });

  it('does not let the window go above the top of the viewport', () => {
    const b = { x: 100, y: -50, width: 400, height: 600 };
    expect(clampToViewport(b, 1440, 900).y).toBe(0);
  });

  it('allows most of the window to slide off the left edge, but not all of it (120px stays on screen)', () => {
    const b = { x: -1000, y: 100, width: 400, height: 600 };
    expect(clampToViewport(b, 1440, 900).x).toBe(-280); // -width + 120
  });

  it('keeps at least 80px of the window reachable on the right', () => {
    const b = { x: 5000, y: 100, width: 400, height: 600 };
    expect(clampToViewport(b, 1440, 900).x).toBe(1360); // viewportWidth - 80
  });
});

describe('isNearRailDropZone', () => {
  it('is false when the window is far from the right edge', () => {
    expect(isNearRailDropZone({ x: 100, y: 100, width: 400, height: 600 }, 1440)).toBe(false);
  });

  it('is true once the window is dragged within the snap threshold of the right edge', () => {
    // right edge of window = 1440 - 950 + 400... compute directly: x + width close to viewportWidth
    expect(isNearRailDropZone({ x: 1000, y: 100, width: 400, height: 600 }, 1440)).toBe(true);
  });

  it('is exactly on the boundary at the threshold (not near)', () => {
    // viewportWidth - (x + width) === 90 -> not < 90
    expect(isNearRailDropZone({ x: 950, y: 100, width: 400, height: 600 }, 1440)).toBe(false);
  });
});

describe('resizedBounds', () => {
  it('grows normally above the minimum size', () => {
    expect(resizedBounds({ width: 400, height: 600 }, 50, 30)).toEqual({ width: 450, height: 630 });
  });

  it('never shrinks below the minimum width', () => {
    expect(resizedBounds({ width: 400, height: 600 }, -1000, 0).width).toBe(MIN_WIDTH);
  });

  it('never shrinks below the minimum height', () => {
    expect(resizedBounds({ width: 400, height: 600 }, 0, -1000).height).toBe(MIN_HEIGHT);
  });
});
