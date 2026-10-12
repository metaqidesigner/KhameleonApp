import { useEffect } from "react";
import { overlayBridge } from "@/lib/desktopBridge";

/**
 * The overlay window is full-screen but ignores the mouse by default, so
 * clicks land on the user's own apps underneath. Electron still forwards
 * mouse *movement* to the page while ignoring clicks, so this watches where
 * the pointer is and switches the window to "catch clicks" only while it's
 * over something marked `data-overlay-hit` (head, toolbars, chat, menus).
 */
export function useClickThrough(): void {
  useEffect(() => {
    const bridge = overlayBridge();
    if (!bridge) return;

    let interactive = false;
    const set = (next: boolean) => {
      if (next === interactive) return;
      interactive = next;
      bridge.setInteractive(next);
    };

    const onMove = (e: MouseEvent) => {
      // Mid-drag (e.g. moving the chat window fast) the pointer can outrun
      // the element under it; keep catching until the button is released.
      if (e.buttons !== 0 && interactive) return;
      const target = e.target instanceof Element ? e.target : null;
      set(!!target?.closest("[data-overlay-hit]"));
    };

    // Deliberately no mouseleave handler: flipping the window between
    // ignore/catch makes Chromium fire a synthetic mouseleave, which would
    // flip it straight back and flicker. Mouse movement alone decides.
    document.addEventListener("mousemove", onMove);
    bridge.setInteractive(false);
    return () => {
      document.removeEventListener("mousemove", onMove);
      bridge.setInteractive(false);
    };
  }, []);
}
