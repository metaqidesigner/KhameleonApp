import { describe, expect, it } from "vitest";
import { CommandRunner, parseCommand } from "../src/commands";
import { WindowController } from "../src/windowController";
import { Bounds, IndicatorState, OverlayBackend, WidgetSpec, WindowBackend, WindowHandle } from "../src/types";

const screen: Bounds = { x: 0, y: 0, width: 1920, height: 1080 };

/** In-memory stand-in for ElectronWidgetBackend — no Electron required. */
class FakeWidgetBackend implements WindowBackend {
  readonly kind = "widget" as const;
  bounds = new Map<string, Bounds>();
  created: WidgetSpec[] = [];
  closed: string[] = [];
  private nextId = 1;

  async create(spec: WidgetSpec, initialBounds: Bounds): Promise<WindowHandle> {
    this.created.push(spec);
    const id = `widget:${this.nextId++}`;
    this.bounds.set(id, initialBounds);
    return { id, backend: "widget", label: spec.label };
  }

  async close(handle: WindowHandle): Promise<void> {
    this.closed.push(handle.id);
    this.bounds.delete(handle.id);
  }

  async getBounds(handle: WindowHandle): Promise<Bounds> {
    const b = this.bounds.get(handle.id);
    if (!b) throw new Error("unknown handle");
    return b;
  }

  async setBounds(handle: WindowHandle, bounds: Bounds): Promise<void> {
    this.bounds.set(handle.id, bounds);
  }
}

/** In-memory stand-in for ExternalWindowBackend — "registered" windows
 * simulate real third-party windows already open on the desktop. */
class FakeExternalBackend implements WindowBackend {
  readonly kind = "external" as const;
  bounds = new Map<string, Bounds>();
  private windows = new Map<string, { id: string; title: string }>(); // lowercase title -> real title

  register(title: string, bounds: Bounds): void {
    const id = `external:${title.toLowerCase().replace(/\s+/g, "-")}`;
    this.windows.set(title.toLowerCase(), { id, title });
    this.bounds.set(id, bounds);
  }

  async find(query: string): Promise<WindowHandle | null> {
    const q = query.toLowerCase();
    for (const [lower, { id, title }] of this.windows) {
      if (lower.includes(q)) return { id, backend: "external", label: title };
    }
    return null;
  }

  async getBounds(handle: WindowHandle): Promise<Bounds> {
    const b = this.bounds.get(handle.id);
    if (!b) throw new Error("unknown handle");
    return b;
  }

  async setBounds(handle: WindowHandle, bounds: Bounds): Promise<void> {
    this.bounds.set(handle.id, bounds);
  }
}

/** In-memory stand-in for ElectronOverlayBackend — records calls instead of
 * drawing anything, so observe()/stopObserving() are testable headlessly. */
class FakeOverlayBackend implements OverlayBackend {
  shown: { handle: WindowHandle; bounds: Bounds; state: IndicatorState }[] = [];
  stateChanges: { handle: WindowHandle; state: IndicatorState }[] = [];
  hidden: string[] = [];

  show(handle: WindowHandle, bounds: Bounds, state: IndicatorState): void {
    this.shown.push({ handle, bounds, state });
  }
  updateBounds(): void {}
  updateState(handle: WindowHandle, state: IndicatorState): void {
    this.stateChanges.push({ handle, state });
  }
  hide(handle: WindowHandle): void {
    this.hidden.push(handle.id);
  }
}

function makeRunner(opts: { permission?: boolean | ((app: string, state: IndicatorState) => Promise<boolean>) } = {}) {
  const widget = new FakeWidgetBackend();
  const external = new FakeExternalBackend();
  const overlay = new FakeOverlayBackend();
  const controller = new WindowController(
    { widget, external },
    () => screen,
    overlay
  );
  const permission =
    typeof opts.permission === "function"
      ? opts.permission
      : async () => opts.permission ?? true;
  return { runner: new CommandRunner(controller, permission), widget, external, overlay, controller };
}

describe("parseCommand", () => {
  it('parses "bring up a youtube video" into an open-widget command', () => {
    const cmd = parseCommand("bring up a youtube video");
    expect(cmd).toEqual({
      type: "open-widget",
      label: "YouTube",
      url: "https://www.youtube.com",
    });
  });

  it("parses a search query out of the request", () => {
    const cmd = parseCommand("open a youtube video of lofi beats");
    expect(cmd?.type).toBe("open-widget");
    if (cmd?.type === "open-widget") {
      expect(cmd.url).toContain(encodeURIComponent("lofi beats"));
    }
  });

  it('parses "move it aside" as docking right', () => {
    expect(parseCommand("move it aside")).toEqual({
      type: "teleport-last",
      preset: "docked-right",
    });
  });

  it("returns null for unrecognized input", () => {
    expect(parseCommand("what's the weather like")).toBeNull();
  });

  it('parses "observe Notepad" as observing', () => {
    expect(parseCommand("observe Notepad")).toEqual({
      type: "observe-external",
      query: "notepad",
      state: "observing",
    });
  });

  it('parses "control Excel" as controlling', () => {
    expect(parseCommand("control Excel")).toEqual({
      type: "observe-external",
      query: "excel",
      state: "controlling",
    });
  });

  it('parses "stop observing" and "stop controlling"', () => {
    expect(parseCommand("stop observing")).toEqual({ type: "stop-observing-last" });
    expect(parseCommand("stop controlling")).toEqual({ type: "stop-observing-last" });
  });
});

describe("CommandRunner — the exact scenario from the original ask", () => {
  it("opens YouTube enlarged, then shrinks and docks it aside on request", async () => {
    const { runner, widget } = makeRunner();

    const openResult = await runner.run("bring up a youtube video");
    expect(openResult).toBe("Opened YouTube, enlarged.");
    expect(widget.created).toHaveLength(1);

    const [id] = widget.bounds.keys();
    const enlargedBounds = widget.bounds.get(id)!;
    expect(enlargedBounds.width).toBeGreaterThan(1000); // genuinely "enlarged"

    const moveResult = await runner.run("move it aside");
    expect(moveResult).toBe("Moved YouTube to docked-right.");

    const dockedBounds = widget.bounds.get(id)!;
    expect(dockedBounds.width).toBeLessThan(enlargedBounds.width); // shrunk
    expect(dockedBounds.x).toBeGreaterThan(enlargedBounds.x); // moved toward the right edge
    expect(dockedBounds.x + dockedBounds.width).toBeCloseTo(1920 - 16, 0); // docked to the edge
  });

  it("says so when asked to move something before anything is open", async () => {
    const { runner } = makeRunner();
    expect(await runner.run("move it aside")).toBe("Nothing open to move yet.");
  });
});

describe("CommandRunner — observing and controlling external windows (Cross-App Control Phase 1)", () => {
  it("asks permission, then shows the colored border and tracks real bounds", async () => {
    const { runner, external, overlay, controller } = makeRunner({ permission: true });
    external.register("Notepad", { x: 10, y: 20, width: 300, height: 200 });

    const result = await runner.run("observe Notepad");

    expect(result).toBe("Now observing Notepad.");
    expect(overlay.shown).toHaveLength(1);
    expect(overlay.shown[0].state).toBe("observing");
    expect(overlay.shown[0].bounds).toEqual({ x: 10, y: 20, width: 300, height: 200 });
    expect(controller.isObserving(overlay.shown[0].handle)).toBe(true);
  });

  it("never shows the border when the user denies the permission prompt", async () => {
    const { runner, external, overlay } = makeRunner({ permission: false });
    external.register("Notepad", { x: 0, y: 0, width: 100, height: 100 });

    const result = await runner.run("observe Notepad");

    expect(result).toBe("Not allowed to observe Notepad.");
    expect(overlay.shown).toHaveLength(0);
  });

  it("says so when the named window can't be found", async () => {
    const { runner } = makeRunner({ permission: true });
    expect(await runner.run("observe Notepad")).toBe('Couldn\'t find a window matching "notepad".');
  });

  it("switches an already-observed window straight to controlling, with no second prompt", async () => {
    let promptCount = 0;
    const { runner, external, overlay } = makeRunner({
      permission: async () => {
        promptCount++;
        return true;
      },
    });
    external.register("Excel", { x: 0, y: 0, width: 800, height: 600 });

    await runner.run("observe Excel");
    const result = await runner.run("control Excel");

    expect(result).toBe("Now controlling Excel.");
    expect(promptCount).toBe(1); // not re-prompted for the same window
    expect(overlay.stateChanges).toEqual([{ handle: overlay.shown[0].handle, state: "controlling" }]);
  });

  it("stops watching and hides the border on request", async () => {
    const { runner, external, overlay, controller } = makeRunner({ permission: true });
    external.register("Notepad", { x: 0, y: 0, width: 100, height: 100 });

    await runner.run("observe Notepad");
    const result = await runner.run("stop observing");

    expect(result).toBe("Stopped watching Notepad.");
    expect(overlay.hidden).toEqual(["external:notepad"]);
    expect(controller.isObserving({ id: "external:notepad", backend: "external" })).toBe(false);
  });

  it("says so when asked to stop observing with nothing being watched", async () => {
    const { runner } = makeRunner();
    expect(await runner.run("stop observing")).toBe("Not observing or controlling anything.");
  });
});
