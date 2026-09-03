import { describe, expect, it } from "vitest";
import { computeLayout } from "../src/layouts";
import { Bounds } from "../src/types";

const screen: Bounds = { x: 0, y: 0, width: 1920, height: 1080 };

describe("computeLayout", () => {
  it("enlarged: is centered and takes most of the screen", () => {
    const b = computeLayout("enlarged", screen);
    expect(b.width).toBe(1344); // 70% of 1920
    expect(b.height).toBe(864); // 80% of 1080
    expect(b.x).toBe(288); // centered horizontally
    expect(b.y).toBe(108); // centered vertically
  });

  it("docked-right: pinned to the right edge with a margin", () => {
    const b = computeLayout("docked-right", screen, 16);
    expect(b.width).toBe(576); // 30% of 1920
    expect(b.x + b.width).toBe(1920 - 16); // right edge respects margin
    expect(b.y).toBe(16);
  });

  it("docked-left: mirrors docked-right on the left edge", () => {
    const b = computeLayout("docked-left", screen, 16);
    expect(b.x).toBe(16);
    expect(b.width).toBe(576);
  });

  it("corner: small thumbnail in the bottom-right", () => {
    const b = computeLayout("corner", screen, 16);
    expect(b.x + b.width).toBe(1920 - 16);
    expect(b.y + b.height).toBe(1080 - 16);
    expect(b.width).toBeLessThan(576); // clearly smaller than docked-right
  });

  it("respects a non-zero screen origin (multi-monitor safe)", () => {
    const secondMonitor: Bounds = { x: 1920, y: 0, width: 1440, height: 900 };
    const b = computeLayout("docked-right", secondMonitor, 10);
    expect(b.x + b.width).toBe(1920 + 1440 - 10);
  });
});
