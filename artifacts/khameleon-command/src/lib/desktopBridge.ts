/**
 * The one place the frontend talks to the Electron shell
 * (apps/khameleon-shell/src/preload.ts). Everything is optional: in a plain
 * browser `window.khameleon` doesn't exist, and the app falls back to the
 * Classic layout (docs/build-review.md, Build 0 - a browser can't float a
 * see-through layer over other programs).
 */
export interface KhameleonOverlayBridge {
  /** true = the overlay catches the mouse; false = clicks pass through to the apps underneath. */
  setInteractive(interactive: boolean): void;
  /** Opens (or focuses) the Classic dashboard in a normal window. */
  openClassicWindow(): void;
  /** Hides the overlay; the global shortcut (Cmd/Ctrl+Shift+K) brings it back. */
  hide(): void;
}

/** Choices the desktop app applies itself (apps/khameleon-shell/src/main.ts, DesktopPrefs). */
export interface DesktopPrefs {
  layout: "overlay" | "classic";
  screen: "follow" | "primary";
}

interface KhameleonDesktopBridge {
  overlay?: KhameleonOverlayBridge;
  prefs?: {
    get(): Promise<DesktopPrefs>;
    set(patch: Partial<DesktopPrefs>): Promise<DesktopPrefs>;
  };
}

function bridge(): KhameleonDesktopBridge | undefined {
  return (window as unknown as { khameleon?: KhameleonDesktopBridge }).khameleon;
}

/** The overlay bridge, or undefined when not running inside the desktop app. */
export function overlayBridge(): KhameleonOverlayBridge | undefined {
  return bridge()?.overlay;
}

/**
 * The overlay layout is served at /overlay and only rendered inside the
 * desktop app's overlay window. Opening /overlay in a browser gets Classic.
 */
export function isOverlayLayout(): boolean {
  return window.location.pathname.startsWith("/overlay") && overlayBridge() !== undefined;
}

/** Saved desktop choices, or undefined in a plain browser. */
export function desktopPrefsBridge(): KhameleonDesktopBridge["prefs"] {
  return bridge()?.prefs;
}

/** Capture (apps/khameleon-shell/src/capture.ts): record a task to turn into a skill. */
export interface CaptureStatus {
  state: "idle" | "recording" | "paused" | "processing";
  steps: number;
  currentApp?: string;
  currentTitle?: string;
  snapshotsAllowed: boolean;
}

export interface CaptureStep { at: number; app: string; title: string; text?: string; note?: string }

export interface KhameleonCaptureBridge {
  status(): Promise<CaptureStatus>;
  start(): Promise<CaptureStatus>;
  pause(): Promise<CaptureStatus>;
  resume(): Promise<CaptureStatus>;
  note(text: string): Promise<CaptureStatus>;
  stop(): Promise<CaptureStep[]>;
  discard(): Promise<void>;
  openSnapshotSettings(): Promise<void>;
  onUpdate(listener: (status: CaptureStatus) => void): () => void;
}

/** Capture is only possible inside the desktop app. */
export function captureBridge(): KhameleonCaptureBridge | undefined {
  return (window as unknown as { khameleon?: { capture?: KhameleonCaptureBridge } }).khameleon?.capture;
}
