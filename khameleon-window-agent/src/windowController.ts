import { computeLayout } from "./layouts";
import { animateBounds } from "./tween";
import {
  Bounds,
  IndicatorState,
  LayoutPreset,
  OverlayBackend,
  TeleportOptions,
  WidgetSpec,
  WindowBackend,
  WindowHandle,
} from "./types";

/** How often to re-read an observed window's real bounds, to catch it
 * being moved/resized/minimized while Khameleon is watching it. */
const OBSERVE_POLL_MS = 300;

/**
 * The single entry point the rest of Khameleon (the command layer, and
 * eventually the agent brain) talks to. Hides whether a given window is
 * one Khameleon spawned itself or a third-party app window behind one
 * consistent API: teleport(), createWidget(), closeWidget(), findExternal().
 */
export class WindowController {
  private active = new Map<string, { cancel: () => void }>();
  private observations = new Map<string, { interval: ReturnType<typeof setInterval>; state: IndicatorState }>();

  constructor(
    private backends: { widget: WindowBackend; external: WindowBackend },
    /** Returns the current screen work area (excludes dock/menu bar). Injected for testability and multi-monitor support later. */
    private screenArea: () => Bounds,
    /** Draws the colored indicator border. Optional so callers that never
     * touch observe() (e.g. existing widget-only tests) don't need one. */
    private overlay?: OverlayBackend
  ) {}

  async createWidget(
    spec: WidgetSpec,
    preset: LayoutPreset = "enlarged"
  ): Promise<WindowHandle> {
    const backend = this.backends.widget;
    if (!backend.create) throw new Error("Widget backend cannot create windows");

    const bounds = computeLayout(preset, this.screenArea());
    return backend.create(spec, bounds);
  }

  async closeWidget(handle: WindowHandle): Promise<void> {
    this.stopAnimation(handle);
    this.stopObserving(handle);
    const backend = this.backendFor(handle);
    if (!backend.close) throw new Error(`${backend.kind} backend cannot close windows`);
    await backend.close(handle);
  }

  async findExternal(query: string): Promise<WindowHandle | null> {
    const backend = this.backends.external;
    if (!backend.find) throw new Error("External backend cannot find windows");
    return backend.find(query);
  }

  async focus(handle: WindowHandle): Promise<void> {
    const backend = this.backendFor(handle);
    if (!backend.focus) throw new Error(`${backend.kind} backend cannot focus windows`);
    await backend.focus(handle);
  }

  async setVisible(handle: WindowHandle, visible: boolean): Promise<void> {
    const backend = this.backendFor(handle);
    if (!backend.setVisible) throw new Error(`${backend.kind} backend cannot change visibility`);
    await backend.setVisible(handle, visible);
  }

  /** Move/resize a window to a named preset, optionally animated. */
  async teleport(
    handle: WindowHandle,
    preset: LayoutPreset,
    opts: TeleportOptions = {}
  ): Promise<void> {
    const { animate = true, durationMs = 350 } = opts;
    const backend = this.backendFor(handle);
    const from = await backend.getBounds(handle);
    const to = computeLayout(preset, this.screenArea());

    this.stopAnimation(handle);

    if (!animate) {
      await backend.setBounds(handle, to);
      return;
    }

    await new Promise<void>((resolve) => {
      const controller = animateBounds({
        from,
        to,
        durationMs,
        onTick: (bounds) => {
          // Fire-and-forget: bounds updates should never block the next frame.
          void backend.setBounds(handle, bounds);
        },
        onDone: () => {
          this.active.delete(handle.id);
          resolve();
        },
      });
      this.active.set(handle.id, controller);
    });
  }

  /**
   * Start showing the colored border around `handle` and tracking its real
   * bounds, so the border follows it if it's moved/resized. Caller (the
   * command layer) is responsible for the permission prompt before calling
   * this - WindowController itself only does the mechanical part.
   */
  async observe(handle: WindowHandle, state: IndicatorState): Promise<void> {
    if (!this.overlay) throw new Error("No overlay backend configured");
    this.stopObserving(handle);

    const backend = this.backendFor(handle);
    const bounds = await backend.getBounds(handle);
    this.overlay.show(handle, bounds, state);

    const interval = setInterval(() => {
      void backend.getBounds(handle).then(
        (b) => this.overlay?.updateBounds(handle, b),
        () => this.stopObserving(handle) // window closed/gone - stop tracking it
      );
    }, OBSERVE_POLL_MS);

    this.observations.set(handle.id, { interval, state });
  }

  /** Switch an already-observed window's indicator (e.g. observing → controlling). */
  setObserveState(handle: WindowHandle, state: IndicatorState): void {
    const entry = this.observations.get(handle.id);
    if (!entry) throw new Error(`Not currently observing ${handle.id}`);
    entry.state = state;
    this.overlay?.updateState(handle, state);
  }

  isObserving(handle: WindowHandle): boolean {
    return this.observations.has(handle.id);
  }

  stopObserving(handle: WindowHandle): void {
    const entry = this.observations.get(handle.id);
    if (!entry) return;
    clearInterval(entry.interval);
    this.observations.delete(handle.id);
    this.overlay?.hide(handle);
  }

  private stopAnimation(handle: WindowHandle): void {
    this.active.get(handle.id)?.cancel();
    this.active.delete(handle.id);
  }

  private backendFor(handle: WindowHandle): WindowBackend {
    return this.backends[handle.backend];
  }
}
