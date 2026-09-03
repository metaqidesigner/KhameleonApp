import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CommandRunner as FileCommandRunner, FileOps, type AppLauncher } from "khameleon-file-agent";
import { CommandRunner as MemoryCommandRunner, InMemoryStorage, MemoryStore } from "khameleon-memory";
import { WindowController, CommandRunner as WindowCommandRunner, type Bounds, type WindowBackend, type WindowHandle } from "khameleon-window-agent";
import { KhameleonCoordinator } from "../src/coordinator";
import type { IntentResolver } from "../src/types";

class FakeWindowBackend implements WindowBackend {
  readonly kind = "widget" as const;
  private bounds = new Map<string, Bounds>();
  async create(_spec: { url: string; label: string }, initialBounds: Bounds): Promise<WindowHandle> {
    const handle = { id: "widget:1", backend: "widget" as const, label: "YouTube" };
    this.bounds.set(handle.id, initialBounds);
    return handle;
  }
  async getBounds(handle: WindowHandle): Promise<Bounds> { return this.bounds.get(handle.id)!; }
  async setBounds(handle: WindowHandle, bounds: Bounds): Promise<void> { this.bounds.set(handle.id, bounds); }
  async close(handle: WindowHandle): Promise<void> { this.bounds.delete(handle.id); }
}

class NoopExternalBackend implements WindowBackend {
  readonly kind = "external" as const;
  async getBounds(): Promise<Bounds> { return { x: 0, y: 0, width: 1, height: 1 }; }
  async setBounds(): Promise<void> {}
}

class FakeLauncher implements AppLauncher {
  opened: string[] = [];
  async open(name: string): Promise<void> { this.opened.push(name); }
  async quit(): Promise<void> {}
  async isRunning(): Promise<boolean> { return false; }
}

function createCoordinator(resolver: IntentResolver, root: string) {
  const widget = new FakeWindowBackend();
  const controller = new WindowController({ widget, external: new NoopExternalBackend() }, () => ({ x: 0, y: 0, width: 1200, height: 800 }));
  return new KhameleonCoordinator(resolver, {
    window: new WindowCommandRunner(controller),
    file: new FileCommandRunner(new FileOps(root), new FakeLauncher()),
    memory: new MemoryCommandRunner(new MemoryStore(new InMemoryStorage())),
  });
}

describe("KhameleonCoordinator", () => {
  it("routes memory intents through the memory module", async () => {
    const root = await mkdtemp(join(tmpdir(), "khameleon-integration-"));
    try {
      const intents: IntentResolver = { resolve: async () => ({ kind: "memory", command: "remember", key: "timezone", value: "EST" }) };
      const coordinator = createCoordinator(intents, root);
      const result = await coordinator.run("remember my timezone is EST");
      expect(result.message).toContain("timezone is EST");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("routes file intents through the path-guarded file module", async () => {
    const root = await mkdtemp(join(tmpdir(), "khameleon-integration-"));
    try {
      const intents: IntentResolver = { resolve: async () => ({ kind: "file", command: "create-folder", value: "Invoices" }) };
      const coordinator = createCoordinator(intents, root);
      await coordinator.run("make an Invoices folder");
      await expect(access(join(root, "Invoices"))).resolves.toBeUndefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("routes window intents through the window controller", async () => {
    const root = await mkdtemp(join(tmpdir(), "khameleon-integration-"));
    try {
      const intents: IntentResolver = { resolve: async () => ({ kind: "window", command: "open", label: "music", url: "https://example.com" }) };
      const result = await createCoordinator(intents, root).run("open music");
      expect(result.message).toContain("Opened YouTube");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
