import { BrowserWindow } from "electron";
import { Bounds, IndicatorState, OverlayBackend, WindowHandle } from "../types";

/**
 * Real implementation of OverlayBackend: a transparent, click-through,
 * always-on-top BrowserWindow per window Khameleon is involved with, sized a
 * little larger than the target so a thin glass glow sits just outside its
 * edges. Colour shows what Khameleon is doing (types.ts IndicatorState;
 * docs/build-review.md, Build 4 expanded): white = can see it, light blue =
 * reading/recording, white pulsing = observing, light green with a
 * travelling shimmer = working, light red = needs you. A small label on the
 * top edge says the same in words (for colour-blind users; can be turned
 * off). Reduce motion makes every glow steady.
 */
const PAD = 8; // glow drawn this far outside the target window

function padded(b: Bounds): Bounds {
  return { x: b.x - PAD, y: b.y - PAD, width: b.width + PAD * 2, height: b.height + PAD * 2 };
}

export class ElectronOverlayBackend implements OverlayBackend {
  private windows = new Map<string, BrowserWindow>();
  private showLabels = true;

  /** Look & layout: show or hide the small words on each glow. */
  setShowLabels(show: boolean): void {
    this.showLabels = show;
    for (const win of this.windows.values()) {
      if (!win.isDestroyed()) win.webContents.executeJavaScript(`window.__khameleonSetLabels(${show})`).catch(() => {});
    }
  }

  show(handle: WindowHandle, bounds: Bounds, state: IndicatorState): void {
    this.hide(handle);

    const win = new BrowserWindow({
      ...padded(bounds),
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
    win.loadURL(`data:text/html,${encodeURIComponent(overlayHtml(state, this.showLabels))}`);
    win.once("ready-to-show", () => win.showInactive());

    win.on("closed", () => {
      if (this.windows.get(handle.id) === win) this.windows.delete(handle.id);
    });

    this.windows.set(handle.id, win);
  }

  updateBounds(handle: WindowHandle, bounds: Bounds): void {
    const win = this.windows.get(handle.id);
    if (!win || win.isDestroyed()) return;
    win.setBounds(padded(bounds));
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

export const GLOW_LABELS: Record<IndicatorState, string> = {
  visible: "Khameleon can see this",
  reading: "Reading",
  observing: "Observing",
  working: "Working",
  "needs-you": "Needs you",
  recording: "Recording",
};

/** The glow page. Exported for tests. */
export function overlayHtml(initialState: IndicatorState, showLabels: boolean): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @property --a { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
  html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; font-family: -apple-system, "Segoe UI", sans-serif; }
  :root { --c: 255,255,255; }
  body.visible, body.observing { --c: 255,255,255; }
  body.reading, body.recording { --c: 142,203,255; }
  body.working { --c: 127,231,168; }
  body.needs-you { --c: 255,138,138; }
  #glow {
    position: fixed; inset: ${PAD - 2}px; box-sizing: border-box; border-radius: 10px;
    border: 1.5px solid rgba(var(--c), 0.9);
    box-shadow: 0 0 12px 2px rgba(var(--c), 0.55), inset 0 0 8px rgba(var(--c), 0.25);
    transition: border-color 300ms ease, box-shadow 300ms ease;
  }
  body.visible #glow { border-color: rgba(var(--c), 0.55); box-shadow: 0 0 8px 1px rgba(var(--c), 0.3); }
  body.observing #glow { animation: pulse 1.8s ease-in-out infinite; }
  body.needs-you #glow { animation: pulse 1.1s ease-in-out infinite; }
  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 8px 1px rgba(var(--c), 0.35), inset 0 0 6px rgba(var(--c), 0.15); }
    50% { box-shadow: 0 0 18px 4px rgba(var(--c), 0.75), inset 0 0 10px rgba(var(--c), 0.3); }
  }
  /* Working: a light shimmer travelling round the border. */
  #shimmer {
    position: fixed; inset: ${PAD - 3}px; border-radius: 11px; padding: 3px; display: none;
    background: conic-gradient(from var(--a), transparent 0 72%, rgba(255,255,255,0.95) 82%, transparent 92%);
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude;
    animation: spin 2.6s linear infinite;
  }
  body.working #shimmer { display: block; }
  @keyframes spin { to { --a: 360deg; } }
  #label {
    position: fixed; top: 0; left: ${PAD + 10}px; display: inline-flex; align-items: center; gap: 5px;
    padding: 2px 8px 3px; border-radius: 0 0 7px 7px; font-size: 10.5px; font-weight: 600; color: #0b1220;
    background: rgba(var(--c), 0.92); box-shadow: 0 2px 8px rgba(0,0,0,0.25);
  }
  #label::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #0b1220; opacity: 0.6; }
  body.nolabels #label { display: none; }
  @media (prefers-reduced-motion: reduce) {
    #glow, #shimmer { animation: none !important; }
    body.working #shimmer { display: none; }
  }
</style></head>
<body class="${initialState}${showLabels ? "" : " nolabels"}">
  <div id="glow"></div>
  <div id="shimmer"></div>
  <div id="label">${GLOW_LABELS[initialState]}</div>
  <script>
    var LABELS = ${JSON.stringify(GLOW_LABELS)};
    window.__khameleonSetState = function (state) {
      var labels = !document.body.classList.contains('nolabels');
      document.body.className = state + (labels ? '' : ' nolabels');
      document.getElementById('label').textContent = LABELS[state] || '';
    };
    window.__khameleonSetLabels = function (show) {
      document.body.classList.toggle('nolabels', !show);
    };
  </script>
</body></html>`;
}
