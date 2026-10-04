import { BrowserWindow } from "electron";
import { Bounds, IndicatorState, OverlayBackend, WindowHandle } from "../types";

/**
 * Real implementation of OverlayBackend: a transparent, click-through,
 * always-on-top BrowserWindow per watched external window, sized and
 * positioned to exactly match the target's bounds so a CSS border drawn
 * at its own edge visually frames the real window underneath. Newton's
 * own accent color (#6FE6BD, matched to TopBar.tsx) - a configurable
 * palette is real future work, not built here (Cross-App Control Phase 1,
 * khameleon-decisions-log.md, 2026-10-03).
 */
export class ElectronOverlayBackend implements OverlayBackend {
  private windows = new Map<string, BrowserWindow>();

  constructor(private readonly color: string = "#6FE6BD") {}

  show(handle: WindowHandle, bounds: Bounds, state: IndicatorState): void {
    this.hide(handle);

    const win = new BrowserWindow({
      ...bounds,
      frame: false,
      transparent: true,
      hasShadow: false,
      focusable: false,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      show: false,
      webPreferences: { contextIsolation: true, sandbox: true },
    });

    win.setAlwaysOnTop(true, "floating");
    win.setIgnoreMouseEvents(true, { forward: true });
    win.loadURL(`data:text/html,${encodeURIComponent(overlayHtml(this.color, state))}`);
    win.once("ready-to-show", () => win.show());

    win.on("closed", () => {
      if (this.windows.get(handle.id) === win) this.windows.delete(handle.id);
    });

    this.windows.set(handle.id, win);
  }

  updateBounds(handle: WindowHandle, bounds: Bounds): void {
    const win = this.windows.get(handle.id);
    if (!win || win.isDestroyed()) return;
    win.setBounds(bounds);
  }

  updateState(handle: WindowHandle, state: IndicatorState): void {
    const win = this.windows.get(handle.id);
    if (!win || win.isDestroyed()) return;
    win.webContents.executeJavaScript(`window.__khameleonSetState(${JSON.stringify(state)})`).catch(() => {
      // Page may not have finished its first load yet; the initial data URL
      // already encodes the right starting state, so a lost update here is
      // harmless (the next real change will land once it's ready).
    });
  }

  hide(handle: WindowHandle): void {
    const win = this.windows.get(handle.id);
    this.windows.delete(handle.id);
    if (win && !win.isDestroyed()) win.close();
  }
}

/**
 * Three visually distinct pulse patterns so a glance tells seeing (slow,
 * subtle) from observing (steady, more visible) from controlling (fast,
 * urgent) apart - Newton's own description of the feature.
 */
function overlayHtml(color: string, initialState: IndicatorState): string {
  return `<!doctype html>
<html><head><style>
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  #border {
    position: fixed; inset: 0; box-sizing: border-box;
    border: 4px solid ${color};
    border-radius: 6px;
  }
  #border.seeing { animation: pulse-seeing 2.5s ease-in-out infinite; }
  #border.observing { animation: pulse-observing 1.4s ease-in-out infinite; }
  #border.controlling { animation: pulse-controlling 0.6s ease-in-out infinite; }
  @keyframes pulse-seeing {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 0.7; }
  }
  @keyframes pulse-observing {
    0%, 100% { opacity: 0.55; border-width: 4px; }
    50% { opacity: 1; border-width: 5px; }
  }
  @keyframes pulse-controlling {
    0%, 100% { opacity: 0.7; border-width: 4px; }
    50% { opacity: 1; border-width: 6px; }
  }
</style></head>
<body>
  <div id="border" class="${initialState}"></div>
  <script>
    window.__khameleonSetState = function (state) {
      document.getElementById('border').className = state;
    };
  </script>
</body></html>`;
}
