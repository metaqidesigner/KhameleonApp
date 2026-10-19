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
  /** The small words on each window glow ("Reading", "Working"...). */
  glowLabels: boolean;
  /** Offer help beside an open email. */
  emailAssistant: boolean;
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
  /** Clicks and typing are being recorded too. */
  fullRecording?: boolean;
  fullRecordingNote?: string;
}

export interface CapturedAction { type: 'click' | 'type' | 'key' | 'secure'; app: string; window: string; role?: string; label?: string; text?: string; key?: string; at?: number }
export interface CaptureStep { at: number; app: string; title: string; text?: string; note?: string; actions?: CapturedAction[] }

export interface KhameleonCaptureBridge {
  status(): Promise<CaptureStatus>;
  start(): Promise<CaptureStatus>;
  pause(): Promise<CaptureStatus>;
  resume(): Promise<CaptureStatus>;
  note(text: string): Promise<CaptureStatus>;
  stop(): Promise<CaptureStep[]>;
  discard(): Promise<void>;
  openSnapshotSettings(): Promise<void>;
  openInputSettings?(): Promise<void>;
  onUpdate(listener: (status: CaptureStatus) => void): () => void;
}

/** Capture is only possible inside the desktop app. */
export function captureBridge(): KhameleonCaptureBridge | undefined {
  return (window as unknown as { khameleon?: { capture?: KhameleonCaptureBridge } }).khameleon?.capture;
}

/** Email assistant (apps/khameleon-shell/src/emailWatch.ts): the email window in front, if any. */
export interface OpenEmail {
  client: "outlook" | "mail" | "gmail-web" | "outlook-web";
  app: string;
  /** The email window, in the overlay's own coordinates. */
  bounds: { x: number; y: number; width: number; height: number };
  subject: string | null;
  sender?: string;
  unread?: boolean;
  receivedAt?: string;
}

export type GlowState = "visible" | "reading" | "observing" | "working" | "needs-you";

export interface KhameleonEmailBridge {
  get(): Promise<OpenEmail | null>;
  setGlow(state: GlowState | null): Promise<void>;
  /** The selected email's text, from Apple Mail/Outlook on a Mac; null where that isn't possible. */
  readOpenEmail(): Promise<{ subject: string; from: string; body: string } | null>;
  copyText(text: string): Promise<void>;
  onUpdate(listener: (email: OpenEmail | null) => void): () => void;
}

export function emailBridge(): KhameleonEmailBridge | undefined {
  return (window as unknown as { khameleon?: { email?: KhameleonEmailBridge } }).khameleon?.email;
}

/** Build 7: pairs this desktop app with the server (lib/desktopLink.ts there), using this window's sign-in. */
export async function pairDesktopLink(): Promise<boolean> {
  const link = (window as unknown as { khameleon?: { desktopLink?: { code(): Promise<string> } } }).khameleon?.desktopLink;
  if (!link) return false;
  const code = await link.code();
  const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/desktop/pair`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
  return res.ok;
}
