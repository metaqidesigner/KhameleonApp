import { describe, expect, it } from "vitest";
import { CommandRunner, parseCommand } from "../src/commands";
import { WindowController } from "../src/windowController";
import { Bounds, WidgetSpec, WindowBackend, WindowHandle } from "../src/types";

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

class FakeExternalBackend implements WindowBackend {
  readonly kind = "external" as const;
  async getBounds(): Promise<Bounds> {
    throw new Error("not used in these tests");
  }
  async setBounds(): Promise<void> {}
}

function makeRunner() {
  const widget = new FakeWidgetBackend();
  const controller = new WindowController(
    { widget, external: new FakeExternalBackend() },
    () => screen
  );
  return { runner: new CommandRunner(controller), widget };
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
