import { describe, expect, it, vi } from "vitest";
import { animateBounds, interpolateBounds, easeInOutCubic } from "../src/tween";
import { Bounds } from "../src/types";

const from: Bounds = { x: 0, y: 0, width: 1000, height: 1000 };
const to: Bounds = { x: 500, y: 0, width: 300, height: 800 };

describe("interpolateBounds", () => {
  it("t=0 returns the start bounds exactly", () => {
    expect(interpolateBounds(from, to, 0)).toEqual(from);
  });

  it("t=1 returns the end bounds exactly", () => {
    expect(interpolateBounds(from, to, 1)).toEqual(to);
  });

  it("clamps out-of-range t instead of overshooting", () => {
    expect(interpolateBounds(from, to, 1.5)).toEqual(to);
    expect(interpolateBounds(from, to, -0.5)).toEqual(from);
  });

  it("easeInOutCubic is a valid 0->1 easing curve", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
  });
});

describe("animateBounds", () => {
  it("ticks from `from` toward `to` and finishes exactly at `to`", () => {
    let clock = 0;
    const now = () => clock;
    const scheduled: Array<() => void> = [];
    const schedule = (cb: () => void) => {
      scheduled.push(cb);
      return scheduled.length;
    };

    const ticks: Bounds[] = [];
    let done = false;

    animateBounds({
      from,
      to,
      durationMs: 100,
      onTick: (b) => ticks.push(b),
      onDone: () => (done = true),
      now,
      schedule,
      clear: () => {},
      frameMs: 25,
    });

    // Drive the fake clock/scheduler manually: 0 -> 25 -> 50 -> 75 -> 100ms.
    while (scheduled.length && !done) {
      const cb = scheduled.shift()!;
      clock += 25;
      cb();
    }

    expect(done).toBe(true);
    expect(ticks[0]).toEqual(from); // first tick at t=0
    expect(ticks[ticks.length - 1]).toEqual(to); // last tick lands exactly on target
    expect(ticks.length).toBeGreaterThan(2); // it's actually animating, not jumping
  });

  it("a zero duration snaps straight to the target with one tick", () => {
    let calls = 0;
    let doneCalled = false;
    animateBounds({
      from,
      to,
      durationMs: 0,
      onTick: (b) => {
        calls++;
        expect(b).toEqual(to);
      },
      onDone: () => (doneCalled = true),
    });
    expect(calls).toBe(1);
    expect(doneCalled).toBe(true);
  });

  it("cancel() stops further ticks", () => {
    let clock = 0;
    const now = () => clock;
    const scheduled: Array<() => void> = [];
    const schedule = (cb: () => void) => {
      scheduled.push(cb);
      return scheduled.length;
    };

    const ticks: Bounds[] = [];
    const handle = animateBounds({
      from,
      to,
      durationMs: 100,
      onTick: (b) => ticks.push(b),
      now,
      schedule,
      clear: () => {},
      frameMs: 25,
    });

    // Run one tick, then cancel before it can reach `to`.
    clock += 25;
    scheduled.shift()!();
    const ticksAfterOneFrame = ticks.length;

    handle.cancel();
    while (scheduled.length) {
      clock += 25;
      scheduled.shift()!();
    }

    expect(ticks.length).toBe(ticksAfterOneFrame); // no more ticks after cancel
    expect(ticks[ticks.length - 1]).not.toEqual(to); // never reached the target
  });
});
