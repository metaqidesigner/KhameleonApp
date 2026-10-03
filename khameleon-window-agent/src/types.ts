/**
 * Shared, platform-agnostic types for the window-management layer.
 * Nothing in this file imports Electron or node-window-manager, so it
 * stays testable without either being installed or running.
 */

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WindowSurface = "react-canvas" | "electron-hosted";
export type WindowPresentation = "normal" | "minimized" | "maximized";
export type WindowZone = "side" | "center" | "right-rail";

export interface WindowContentDescriptor {
  kind: WindowSurface;
  contentKey: string;
  live: boolean;
  url?: string;
  sessionPartition?: string;
}

export interface WindowCapabilities {
  canFocus: boolean;
  canMinimize: boolean;
  canMaximize: boolean;
  canResize: boolean;
  canObserve: boolean;
  canManipulate: boolean;
}

export interface SharedWindowModel {
  id: string;
  title: string;
  surface: WindowSurface;
  content: WindowContentDescriptor;
  capabilities: WindowCapabilities;
  presentation: WindowPresentation;
  focused: boolean;
  zone: WindowZone;
  bounds: Bounds;
  restoreBounds: Bounds | null;
  zIndex: number;
  updatedAt: string;
}

export type PersistedWindowModel = Omit<SharedWindowModel, "capabilities">;

export interface WindowPersistenceAdapter {
  loadAll(): Promise<PersistedWindowModel[]>;
  save(window: PersistedWindowModel): Promise<void>;
  remove(windowId: string): Promise<void>;
}

export interface WindowRuntimeAdapter {
  readonly surface: WindowSurface;
  getBounds(windowId: string): Promise<Bounds>;
  setBounds(windowId: string, bounds: Bounds): Promise<void>;
  focus(windowId: string): Promise<void>;
  setVisible(windowId: string, visible: boolean): Promise<void>;
}

/** A handle to a window Khameleon knows about, regardless of backend. */
export interface WindowHandle {
  /** Stable id we assign, e.g. "widget:youtube-1" or "external:12345" */
  id: string;
  /** Which backend owns this window: our own spawned widgets, or a third-party app window. */
  backend: "widget" | "external";
  /** Best-effort human label, e.g. "YouTube" or "Notes" */
  label?: string;
}

/**
 * What Khameleon is currently doing to an external window it's watching -
 * the three states the colored border overlay signals (Cross-App Control,
 * khameleon-decisions-log.md, 2026-10-03). "seeing" is a one-off glance
 * (e.g. reading a document's content); "observing" is ongoing, passive
 * monitoring; "controlling" is actively driving it (clicks/keystrokes).
 */
export type IndicatorState = "seeing" | "observing" | "controlling";

/**
 * Draws the colored, pulsating border around an external window that
 * signals which IndicatorState Khameleon is in for it. A thin platform
 * seam like WindowBackend above - src/backends/electronOverlayBackend.ts
 * is the only real implementation, so tests can use a fake with no
 * Electron dependency.
 */
export interface OverlayBackend {
  show(handle: WindowHandle, bounds: Bounds, state: IndicatorState): void;
  updateBounds(handle: WindowHandle, bounds: Bounds): void;
  updateState(handle: WindowHandle, state: IndicatorState): void;
  hide(handle: WindowHandle): void;
}

/** Named layout presets. Kept small and explicit on purpose for v1. */
export type LayoutPreset =
  | "enlarged" // large, centered — the default "pop up" state
  | "docked-right" // shrunk, pinned to the right edge — "move aside"
  | "docked-left" // shrunk, pinned to the left edge
  | "corner"; // small thumbnail, bottom-right corner

export interface WidgetSpec {
  /** What to load in the widget window. */
  url: string;
  /** Human label used for lookups/logging, e.g. "YouTube" */
  label: string;
  /** Persistent Electron session partition for a hosted third-party app. */
  sessionPartition?: string;
  /** Keep rendered content active while the hosted window is hidden/reduced. */
  keepLiveWhenHidden?: boolean;
  /** Keep the widget above other windows once placed. */
  alwaysOnTop?: boolean;
}

export interface TeleportOptions {
  animate?: boolean;
  durationMs?: number;
}

/**
 * Anything that can report/change a window's bounds, and optionally
 * create/close/find windows, implements this. Electron's BrowserWindow
 * and node-window-manager's Window both get thin adapters to this shape
 * in src/backends/.
 */
export interface WindowBackend {
  readonly kind: WindowHandle["backend"];
  getBounds(handle: WindowHandle): Promise<Bounds>;
  setBounds(handle: WindowHandle, bounds: Bounds): Promise<void>;
  focus?(handle: WindowHandle): Promise<void>;
  setVisible?(handle: WindowHandle, visible: boolean): Promise<void>;
  create?(spec: WidgetSpec, initialBounds: Bounds): Promise<WindowHandle>;
  close?(handle: WindowHandle): Promise<void>;
  find?(query: string): Promise<WindowHandle | null>;
}
