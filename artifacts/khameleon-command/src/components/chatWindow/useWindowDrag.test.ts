import { describe, it, expect } from 'vitest';
import { clampToViewport, fitToViewport, isNearRailDropZone, resizedBounds, MIN_WIDTH, MIN_HEIGHT } from './useWindowDrag';

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

describe('fitToViewport', () => {
  it('leaves bounds unchanged when the whole window already fits with margin', () => {
    const b = { x: 100, y: 100, width: 400, height: 600 };
    expect(fitToViewport(b, 1440, 900)).toEqual(b);
  });

  it('pulls the window fully back on screen when it is positioned past the right/bottom edge', () => {
    const b = { x: 1200, y: 800, width: 400, height: 600 };
    const fitted = fitToViewport(b, 1440, 900);
    expect(fitted.x + fitted.width).toBeLessThanOrEqual(1440 - 16);
    expect(fitted.y + fitted.height).toBeLessThanOrEqual(900 - 16);
  });

  it('pulls the window back on screen when it is positioned off the top/left edge', () => {
    const b = { x: -200, y: -200, width: 400, height: 600 };
    const fitted = fitToViewport(b, 1440, 900);
    expect(fitted.x).toBeGreaterThanOrEqual(16);
    expect(fitted.y).toBeGreaterThanOrEqual(16);
  });

  it('shrinks the window to fit a viewport shorter than its stored height', () => {
    const b = { x: 100, y: 100, width: 400, height: 600 };
    const fitted = fitToViewport(b, 1440, 500);
    expect(fitted.height).toBe(468); // 500 - 16px margin on each side
  });

  it('never shrinks height below MIN_HEIGHT even on a very short viewport', () => {
    const b = { x: 100, y: 100, width: 400, height: 600 };
    const fitted = fitToViewport(b, 1440, 400);
    expect(fitted.height).toBe(MIN_HEIGHT);
  });

  it('shrinks the window to fit a viewport narrower than its stored width, never below MIN_WIDTH', () => {
    const b = { x: 100, y: 100, width: 400, height: 600 };
    const fitted = fitToViewport(b, 360, 900);
    expect(fitted.width).toBe(MIN_WIDTH);
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
