import { BrowserWindow, screen } from "electron";
import type { PointerBackend } from "../types";

/**
 * The Khameleon pointer on screen (docs/build-review.md, Build 4 expanded):
 * a small transparent window holding a Khameleon-coloured cursor and a
 * caption, gliding to where Khameleon is about to act. Always on top, never
 * catches the mouse, never takes focus.
 */
const WIDTH = 340;
const HEIGHT = 64;
const GLIDE_MS = 260;

export class ElectronPointerBackend implements PointerBackend {
  private win: BrowserWindow | null = null;
  private at: { x: number; y: number } | null = null;

  private ensure(): BrowserWindow {
    if (this.win && !this.win.isDestroyed()) return this.win;
    const start = this.at ?? screen.getCursorScreenPoint();
    const win = new BrowserWindow({
      x: Math.round(start.x), y: Math.round(start.y), width: WIDTH, height: HEIGHT,
      frame: false, transparent: true, hasShadow: false, focusable: false, skipTaskbar: true,
      resizable: false, movable: false, show: false,
      webPreferences: { contextIsolation: true, sandbox: true },
    });
    win.setAlwaysOnTop(true, "screen-saver");
    win.setIgnoreMouseEvents(true);
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.loadURL(`data:text/html,${encodeURIComponent(POINTER_HTML)}`);
    win.once("ready-to-show", () => win.showInactive());
    this.win = win;
    return win;
  }

  async moveTo(point: { x: number; y: number } | undefined, caption: string): Promise<void> {
    const win = this.ensure();
    this.setCaption(caption);
    if (!point) return;
    const from = this.at ?? point;
    this.at = point;
    const steps = Math.max(1, Math.round(GLIDE_MS / 16));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const e = 1 - Math.pow(1 - t, 3); // ease-out
      if (win.isDestroyed()) return;
      // The cursor's tip sits at the window's top-left corner.
      win.setPosition(Math.round(from.x + (point.x - from.x) * e), Math.round(from.y + (point.y - from.y) * e));
      await new Promise((r) => setTimeout(r, 16));
    }
  }

  setCaption(caption: string, paused = false): void {
    const win = this.ensure();
    win.webContents.executeJavaScript(`window.__setCaption(${JSON.stringify(caption)}, ${paused})`).catch(() => {});
  }

  hide(): void {
    if (this.win && !this.win.isDestroyed()) this.win.close();
    this.win = null;
  }
}

const POINTER_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  html, body { margin: 0; background: transparent; overflow: hidden; font-family: -apple-system, "Segoe UI", sans-serif; }
  svg { position: absolute; left: 0; top: 0; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.45)); }
  #cap {
    position: absolute; left: 22px; top: 18px; max-width: ${WIDTH - 30}px; padding: 4px 9px; border-radius: 8px;
    font-size: 11.5px; font-weight: 600; color: #0b1220; background: rgba(127,231,168,0.95);
    box-shadow: 0 2px 10px rgba(0,0,0,0.3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  #cap.paused { background: rgba(255,214,140,0.96); }
  #cap:empty { display: none; }
</style></head><body>
  <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true">
    <path d="M2 2 L2 20 L7 15.5 L10.5 23 L14 21.4 L10.6 14 L17.5 14 Z" fill="#6FE6BD" stroke="#0b1220" stroke-width="1.6" stroke-linejoin="round"/>
  </svg>
  <div id="cap"></div>
  <script>
    window.__setCaption = function (text, paused) {
      var c = document.getElementById('cap');
      c.textContent = text || '';
      c.className = paused ? 'paused' : '';
    };
  </script>
</body></html>`;
