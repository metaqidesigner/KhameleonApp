import { windowManager, Window as NWMWindow } from "node-window-manager";
import { Bounds, WindowBackend, WindowHandle } from "../types";

/**
 * Backend for windows Khameleon did NOT spawn — real third-party app
 * windows already open on the desktop (a browser playing YouTube, Notes,
 * whatever). This is the "reach out and control any window" capability,
 * built on node-window-manager (MIT), the same library IRIS-AI's
 * "Teleport Windows" feature is built on.
 *
 * On macOS this requires an accessibility permission grant — see
 * requestAccessibility() below, called once at startup.
 */
export class ExternalWindowBackend implements WindowBackend {
  readonly kind = "external" as const;
  private cache = new Map<string, NWMWindow>();

  requestAccessibility(): void {
    // No-op on Windows; prompts the macOS accessibility dialog if needed.
    windowManager.requestAccessibility?.();
  }

  async find(query: string): Promise<WindowHandle | null> {
    const q = query.toLowerCase();
    const match = windowManager
      .getWindows()
      .find((w: NWMWindow) => w.getTitle().toLowerCase().includes(q));

    if (!match) return null;

    const id = `external:${match.id}`;
    this.cache.set(id, match);
    return { id, backend: "external", label: match.getTitle() };
  }

  async getBounds(handle: WindowHandle): Promise<Bounds> {
    return this.require(handle).getBounds() as Bounds;
  }

  async setBounds(handle: WindowHandle, bounds: Bounds): Promise<void> {
    this.require(handle).setBounds(bounds);
  }

  async focus(handle: WindowHandle): Promise<void> {
    const win = this.require(handle) as NWMWindow & { bringToTop?: () => void };
    win.bringToTop?.();
  }

  async setVisible(handle: WindowHandle, visible: boolean): Promise<void> {
    const win = this.require(handle) as NWMWindow & { show?: () => void; hide?: () => void };
    if (visible) win.show?.();
    else win.hide?.();
  }

  private require(handle: WindowHandle): NWMWindow {
    const win = this.cache.get(handle.id);
    if (!win) {
      throw new Error(
        `No external window cached for ${handle.id} — call find() first.`
      );
    }
    return win;
  }
}
