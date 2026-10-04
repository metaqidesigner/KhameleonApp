import { windowManager } from "node-window-manager";
import { ClickTarget, InputBackend, WindowHandle } from "../types";

/**
 * Real click/type for third-party (external) windows on macOS, via Quartz
 * Event Services, running in-process inside node-window-manager's own
 * addon (a patch - patches/node-window-manager@2.2.4.patch, Cross-App
 * Control Phase 2, khameleon-decisions-log.md, 2026-10-03).
 *
 * The original approach here shelled out to `osascript` (System Events'
 * "click at"/"keystroke"), matching khameleon-file-agent's existing
 * "shell out to the OS's own scripting layer" pattern. That hit a real,
 * documented macOS wall: `osascript` needs its OWN separate Accessibility
 * grant, independent of the calling app's - and even correctly granted
 * (confirmed via screenshot, toggle on), it kept failing "not allowed
 * assistive access", a known unreliable corner of osascript's own TCC
 * trust evaluation. Doing the click/type in-process instead reuses the
 * exact same already-working, already-granted trust context
 * getWindowBounds/setWindowBounds use successfully - no separate process,
 * no separate identity, no separate permission to go wrong.
 */
export class MacNativeInputBackend implements InputBackend {
  async click(_handle: WindowHandle, target: ClickTarget): Promise<void> {
    if (!target.point) {
      throw new Error("macOS native click needs absolute screen coordinates (a CSS selector only works for browser windows).");
    }
    if (!windowManager.simulateClick?.(target.point.x, target.point.y)) {
      throw new Error("Native click simulation isn't available (unexpected on macOS - check the node-window-manager patch applied).");
    }
  }

  async type(handle: WindowHandle, target: ClickTarget | null, text: string): Promise<void> {
    if (target) await this.click(handle, target);
    if (!windowManager.simulateTypeText?.(text)) {
      throw new Error("Native keystroke simulation isn't available (unexpected on macOS - check the node-window-manager patch applied).");
    }
  }
}
