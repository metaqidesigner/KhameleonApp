import { BrowserWindow, session } from "electron";
import { Bounds, WidgetSpec, WindowBackend, WindowHandle } from "../types";

/**
 * Backend for windows Khameleon spawns itself (e.g. a floating YouTube
 * player). Owns the actual BrowserWindow instances behind stable ids.
 */
export class ElectronWidgetBackend implements WindowBackend {
  readonly kind = "widget" as const;
  private windows = new Map<string, BrowserWindow>();
  private nextId = 1;

  async create(spec: WidgetSpec, initialBounds: Bounds): Promise<WindowHandle> {
    const id = `widget:${spec.label.toLowerCase().replace(/\s+/g, "-")}-${this.nextId++}`;
    const partition = spec.sessionPartition ?? `persist:khameleon-${spec.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

    const win = new BrowserWindow({
      x: initialBounds.x,
      y: initialBounds.y,
      width: initialBounds.width,
      height: initialBounds.height,
      frame: false,
      alwaysOnTop: spec.alwaysOnTop ?? true,
      show: false,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: spec.keepLiveWhenHidden !== false,
        session: session.fromPartition(partition),
      },
    });

    await win.loadURL(spec.url);
    win.on("closed", () => this.windows.delete(id));
    this.windows.set(id, win);
    win.show();

    return { id, backend: "widget", label: spec.label };
  }

  async close(handle: WindowHandle): Promise<void> {
    const win = this.require(handle);
    if (!win.isDestroyed()) win.close();
    this.windows.delete(handle.id);
  }

  async getBounds(handle: WindowHandle): Promise<Bounds> {
    return this.require(handle).getBounds();
  }

  async setBounds(handle: WindowHandle, bounds: Bounds): Promise<void> {
    const win = this.require(handle);
    if (win.isDestroyed()) return;
    win.setBounds(bounds);
  }

  async focus(handle: WindowHandle): Promise<void> {
    const win = this.require(handle);
    if (!win.isDestroyed()) win.focus();
  }

  async setVisible(handle: WindowHandle, visible: boolean): Promise<void> {
    const win = this.require(handle);
    if (win.isDestroyed()) return;
    if (visible) win.show();
    else win.hide();
  }

  /** Exposed for BrowserInputBackend - CDP attaches to a webContents, not a BrowserWindow. */
  getWebContents(handle: WindowHandle): Electron.WebContents {
    return this.require(handle).webContents;
  }

  private require(handle: WindowHandle): BrowserWindow {
    const win = this.windows.get(handle.id);
    if (!win) throw new Error(`No widget window for handle ${handle.id}`);
    return win;
  }
}
