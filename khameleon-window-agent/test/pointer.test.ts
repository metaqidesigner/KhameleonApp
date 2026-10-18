import { describe, it, expect } from "vitest";
import { WindowController } from "../src/windowController";
import type { Bounds, ClickTarget, InputBackend, PointerBackend, UserActivityMonitor, WindowBackend, WindowHandle } from "../src/types";

const handle: WindowHandle = { id: "widget:1", backend: "widget", label: "Notes" };

class NoopBackend implements WindowBackend {
  readonly kind = "widget" as const;
  async getBounds(): Promise<Bounds> { return { x: 0, y: 0, width: 100, height: 100 }; }
  async setBounds(): Promise<void> {}
}

class RecordingInput implements InputBackend {
  log: string[] = [];
  constructor(private events: string[]) {}
  async click(_h: WindowHandle, target: ClickTarget) { this.events.push(`click ${target.point?.x},${target.point?.y}`); }
  async type(_h: WindowHandle, _t: ClickTarget | null, text: string) { this.events.push(`type ${text}`); }
}

class RecordingPointer implements PointerBackend {
  constructor(private events: string[]) {}
  async moveTo(point: { x: number; y: number } | undefined, caption: string) { this.events.push(`pointer ${point ? `${point.x},${point.y}` : "-"} ${caption}`); }
  setCaption(caption: string, paused?: boolean) { this.events.push(`caption ${caption}${paused ? " (paused)" : ""}`); }
  hide() { this.events.push("pointer hidden"); }
}

class ScriptedActivity implements UserActivityMonitor {
  ignored: number[] = [];
  constructor(private busy: boolean[]) {}
  isUserBusy() { return this.busy.shift() ?? false; }
  ignoreOwnInputFor(ms: number) { this.ignored.push(ms); }
}

function makeController(busy: boolean[] = []) {
  const events: string[] = [];
  const activity = new ScriptedActivity(busy);
  const input = new RecordingInput(events);
  const controller = new WindowController(
    { widget: new NoopBackend(), external: new NoopBackend() },
    () => ({ x: 0, y: 0, width: 1000, height: 800 }),
    undefined,
    { browser: input, native: input },
    { pointer: new RecordingPointer(events), activity },
  );
  return { controller, events, activity };
}

describe("Khameleon pointer", () => {
  it("moves the pointer to the spot with a caption before clicking", async () => {
    const { controller, events } = makeController();
    await controller.click(handle, { point: { x: 120, y: 40 } }, "Clicking Submit");
    expect(events).toEqual(["pointer 120,40 Clicking Submit", "click 120,40"]);
  });

  it("captions typing with the text being typed (shortened when long)", async () => {
    const { controller, events } = makeController();
    await controller.type(handle, null, "Q3 revenue");
    await controller.type(handle, null, "x".repeat(60));
    expect(events[0]).toBe('pointer - Typing "Q3 revenue"');
    expect(events[2]).toBe(`pointer - Typing "${"x".repeat(37)}..."`);
  });

  it("pauses while the user is using the mouse or keyboard, then carries on", async () => {
    const { controller, events } = makeController([true, true, false]);
    await controller.click(handle, { point: { x: 5, y: 5 } }, "Clicking Save");
    expect(events).toEqual([
      "pointer 5,5 Clicking Save",
      "caption Paused - you're using this window (paused)",
      "caption Clicking Save",
      "click 5,5",
    ]);
  });

  it("ignores Khameleon's own input so it doesn't pause itself", async () => {
    const { controller, activity } = makeController();
    await controller.click(handle, { point: { x: 1, y: 1 } });
    await controller.type(handle, null, "abc");
    expect(activity.ignored).toEqual([600, 520]);
  });

  it("gives up rather than waiting forever if the user keeps working", async () => {
    const events: string[] = [];
    const input = new RecordingInput(events);
    const controller = new WindowController(
      { widget: new NoopBackend(), external: new NoopBackend() },
      () => ({ x: 0, y: 0, width: 1000, height: 800 }),
      undefined,
      { browser: input, native: input },
      { pointer: new RecordingPointer(events), activity: { isUserBusy: () => true, ignoreOwnInputFor: () => {} }, pauseTimeoutMs: 300 },
    );
    await expect(controller.click(handle, { point: { x: 1, y: 1 } })).rejects.toThrow(/Paused too long/);
    expect(events).not.toContain("click 1,1");
  });
});
